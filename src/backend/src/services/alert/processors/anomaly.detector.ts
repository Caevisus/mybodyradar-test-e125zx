import { Matrix } from 'ml-matrix'; // ^6.10.0
import { mean, standardDeviation, covariance } from 'ml-stat'; // ^1.3.3
import { IAlert, IAlertDetails } from '../../../interfaces/alert.interface';
import { ISensorData } from '../../../interfaces/sensor.interface';
import { Logger } from '../../../utils/logger.util';
import { ALERT_TYPES, ALERT_SEVERITY, ALERT_THRESHOLDS } from '../../../constants/alert.constants';

/**
 * Advanced real-time anomaly detection system for biomechanical and physiological data
 * Implements high-sensitivity detection with <100ms latency as per technical requirements
 */
export class AnomalyDetector {
  private readonly logger: Logger;
  private baselineData: Map<string, Matrix>;
  private covarianceMatrices: Map<string, Matrix>;
  private thresholds: Map<string, number[]>;
  private readonly processingWindow: number;
  private readonly confidenceThreshold: number;

  /**
   * Initializes the anomaly detector with optimized configurations
   * @param processingWindow - Time window for data analysis in ms (default: 100ms)
   * @param confidenceThreshold - Minimum confidence score for anomaly detection (default: 0.85)
   */
  constructor(processingWindow: number = 100, confidenceThreshold: number = 0.85) {
    this.logger = new Logger('AnomalyDetector');
    this.baselineData = new Map();
    this.covarianceMatrices = new Map();
    this.thresholds = new Map();
    this.processingWindow = processingWindow;
    this.confidenceThreshold = confidenceThreshold;

    // Initialize thresholds from constants
    this.initializeThresholds();
  }

  /**
   * Performs real-time anomaly detection on sensor data
   * @param sensorData - Raw sensor data from smart apparel
   * @returns Promise<IAlert[]> - Array of detected anomalies
   */
  public async detectAnomalies(sensorData: ISensorData): Promise<IAlert[]> {
    try {
      const startTime = Date.now();
      const alerts: IAlert[] = [];

      // Convert sensor readings to matrix format for efficient processing
      const dataMatrix = new Matrix(sensorData.readings.map(reading => reading.value));

      // Parallel processing of biomechanical and physiological data
      const [biomechanicalAlerts, physiologicalAlerts] = await Promise.all([
        this.analyzeBiomechanicalData(dataMatrix),
        this.analyzePhysiologicalData(dataMatrix)
      ]);

      alerts.push(...biomechanicalAlerts, ...physiologicalAlerts);

      // Log processing performance
      const processingTime = Date.now() - startTime;
      this.logger.performance('anomaly_detection_latency', processingTime, {
        readingsCount: sensorData.readings.length,
        alertsGenerated: alerts.length
      });

      return alerts;
    } catch (error) {
      this.logger.error('Error in anomaly detection', error as Error);
      throw error;
    }
  }

  /**
   * Analyzes biomechanical data for movement anomalies
   * @param data - Matrix of biomechanical sensor readings
   * @returns IAlert[] - Detected biomechanical anomalies
   */
  private analyzeBiomechanicalData(data: Matrix): IAlert[] {
    const alerts: IAlert[] = [];
    const biomechanicalThresholds = ALERT_THRESHOLDS.BIOMECHANICAL;

    // Calculate Mahalanobis distance for movement pattern analysis
    const meanVector = data.mean('column');
    const covMatrix = this.covarianceMatrices.get('biomechanical') || 
                     new Matrix(covariance(data.to2DArray()));

    data.to2DArray().forEach((row, index) => {
      const distance = this.calculateMahalanobisDistance(row, meanVector.to1DArray(), covMatrix);

      // Check for force threshold violations
      if (Math.max(...row) > biomechanicalThresholds.FORCE) {
        alerts.push(this.createAlert(
          ALERT_TYPES.BIOMECHANICAL,
          ALERT_SEVERITY.HIGH,
          'Excessive force detected',
          {
            currentValue: Math.max(...row),
            threshold: biomechanicalThresholds.FORCE,
            confidence: this.calculateConfidence(distance)
          }
        ));
      }

      // Check for movement asymmetry
      const asymmetryScore = this.calculateAsymmetryScore(row);
      if (asymmetryScore > biomechanicalThresholds.ASYMMETRY) {
        alerts.push(this.createAlert(
          ALERT_TYPES.BIOMECHANICAL,
          ALERT_SEVERITY.MEDIUM,
          'Movement asymmetry detected',
          {
            currentValue: asymmetryScore,
            threshold: biomechanicalThresholds.ASYMMETRY,
            confidence: this.calculateConfidence(distance)
          }
        ));
      }
    });

    return alerts;
  }

  /**
   * Analyzes physiological data for health-related anomalies
   * @param data - Matrix of physiological sensor readings
   * @returns IAlert[] - Detected physiological anomalies
   */
  private analyzePhysiologicalData(data: Matrix): IAlert[] {
    const alerts: IAlert[] = [];
    const physiologicalThresholds = ALERT_THRESHOLDS.PHYSIOLOGICAL;

    // Calculate rolling statistics for physiological metrics
    const rollingMean = data.mean('column');
    const rollingStd = new Matrix([data.std('column')]);

    data.to2DArray().forEach((row, index) => {
      // Check for excessive strain
      const strainIndex = this.calculateStrainIndex(row);
      if (strainIndex > physiologicalThresholds.STRAIN) {
        alerts.push(this.createAlert(
          ALERT_TYPES.PHYSIOLOGICAL,
          ALERT_SEVERITY.HIGH,
          'High physiological strain detected',
          {
            currentValue: strainIndex,
            threshold: physiologicalThresholds.STRAIN,
            confidence: this.calculateConfidence(strainIndex / physiologicalThresholds.STRAIN)
          }
        ));
      }

      // Check for fatigue indicators
      const fatigueScore = this.calculateFatigueScore(row, rollingMean.to1DArray());
      if (fatigueScore > physiologicalThresholds.FATIGUE) {
        alerts.push(this.createAlert(
          ALERT_TYPES.PHYSIOLOGICAL,
          ALERT_SEVERITY.MEDIUM,
          'Fatigue warning',
          {
            currentValue: fatigueScore,
            threshold: physiologicalThresholds.FATIGUE,
            confidence: this.calculateConfidence(fatigueScore / physiologicalThresholds.FATIGUE)
          }
        ));
      }
    });

    return alerts;
  }

  /**
   * Updates baseline data for adaptive thresholding
   * @param sensorId - Identifier for the sensor
   * @param newData - New baseline data matrix
   */
  public updateBaseline(sensorId: string, newData: Matrix): void {
    try {
      // Update baseline with exponential weighting
      const existingBaseline = this.baselineData.get(sensorId);
      if (existingBaseline) {
        const weightedBaseline = existingBaseline.mul(0.7).add(newData.mul(0.3));
        this.baselineData.set(sensorId, weightedBaseline);
      } else {
        this.baselineData.set(sensorId, newData);
      }

      // Update covariance matrix
      this.covarianceMatrices.set(sensorId, new Matrix(covariance(newData.to2DArray())));

      this.logger.info('Baseline updated', { sensorId });
    } catch (error) {
      this.logger.error('Error updating baseline', error as Error);
      throw error;
    }
  }

  /**
   * Initializes detection thresholds from constants
   */
  private initializeThresholds(): void {
    Object.entries(ALERT_THRESHOLDS).forEach(([category, thresholds]) => {
      this.thresholds.set(category, Object.values(thresholds));
    });
  }

  /**
   * Calculates Mahalanobis distance for anomaly detection
   */
  private calculateMahalanobisDistance(vector: number[], mean: number[], covMatrix: Matrix): number {
    const diff = new Matrix([vector]).sub(new Matrix([mean]));
    const invCov = covMatrix.pseudoInverse();
    return Math.sqrt(diff.mmul(invCov).mmul(diff.transpose()).get(0, 0));
  }

  /**
   * Calculates movement asymmetry score
   */
  private calculateAsymmetryScore(data: number[]): number {
    const leftSide = data.slice(0, data.length / 2);
    const rightSide = data.slice(data.length / 2);
    return Math.abs(mean(leftSide) - mean(rightSide)) / mean(data) * 100;
  }

  /**
   * Calculates physiological strain index
   */
  private calculateStrainIndex(data: number[]): number {
    return mean(data) * standardDeviation(data);
  }

  /**
   * Calculates fatigue score based on trend analysis
   */
  private calculateFatigueScore(current: number[], baseline: number[]): number {
    return current.reduce((acc, val, idx) => {
      return acc + Math.abs(val - baseline[idx]) / baseline[idx];
    }, 0) / current.length * 100;
  }

  /**
   * Calculates confidence score for anomaly detection
   */
  private calculateConfidence(value: number): number {
    return Math.min(Math.max(value / this.confidenceThreshold, 0), 1);
  }

  /**
   * Creates a standardized alert object
   */
  private createAlert(
    type: ALERT_TYPES,
    severity: ALERT_SEVERITY,
    message: string,
    details: Partial<IAlertDetails>
  ): IAlert {
    return {
      id: crypto.randomUUID(),
      type,
      severity,
      status: 'ACTIVE',
      timestamp: new Date(),
      message,
      details: details as IAlertDetails,
      confidenceScore: details.confidence || 0
    } as IAlert;
  }
}