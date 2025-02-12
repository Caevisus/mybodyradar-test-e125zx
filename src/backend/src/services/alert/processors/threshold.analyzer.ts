import { IAlert } from '../../../interfaces/alert.interface';
import { ISensorData } from '../../../interfaces/sensor.interface';
import { Logger } from '../../../utils/logger.util';
import { ALERT_TYPES, ALERT_SEVERITY, ALERT_THRESHOLDS } from '../../../constants/alert.constants';
import { PERFORMANCE_THRESHOLDS } from '../../../constants/system.constants';

/**
 * Advanced analyzer for real-time sensor data processing against dynamic thresholds
 * with historical trend analysis and confidence scoring
 */
export class ThresholdAnalyzer {
  private logger: Logger;
  private historicalReadings: Map<string, number[]>;
  private readonly HISTORY_WINDOW_SIZE = 100;
  private readonly CONFIDENCE_THRESHOLD = 0.85; // 85% confidence requirement
  private readonly PROCESSING_LATENCY_THRESHOLD = PERFORMANCE_THRESHOLDS.MAX_LATENCY_MS;

  constructor() {
    this.logger = new Logger('ThresholdAnalyzer', {
      performanceTracking: true,
      sampling: true
    });
    this.historicalReadings = new Map();
  }

  /**
   * Analyzes biomechanical sensor data with multi-point validation and trend analysis
   * @param sensorData Incoming sensor data packet
   * @returns Array of high-confidence biomechanical alerts with context
   */
  public async analyzeBiomechanicalData(sensorData: ISensorData): Promise<IAlert[]> {
    const startTime = Date.now();
    const alerts: IAlert[] = [];

    try {
      // Validate data integrity
      if (!this.validateSensorData(sensorData)) {
        this.logger.warn('Invalid sensor data received', { sensorId: sensorData.sensorId });
        return alerts;
      }

      // Process force-related metrics
      if (this.exceedsThreshold(sensorData, 'FORCE', ALERT_THRESHOLDS.BIOMECHANICAL.FORCE)) {
        const alert = await this.createBiomechanicalAlert(
          sensorData,
          'FORCE',
          'Excessive force detected',
          ALERT_THRESHOLDS.BIOMECHANICAL.FORCE
        );
        if (alert) alerts.push(alert);
      }

      // Process impact metrics
      if (this.exceedsThreshold(sensorData, 'IMPACT', ALERT_THRESHOLDS.BIOMECHANICAL.IMPACT)) {
        const alert = await this.createBiomechanicalAlert(
          sensorData,
          'IMPACT',
          'High impact detected',
          ALERT_THRESHOLDS.BIOMECHANICAL.IMPACT
        );
        if (alert) alerts.push(alert);
      }

      // Process asymmetry metrics
      if (this.exceedsThreshold(sensorData, 'ASYMMETRY', ALERT_THRESHOLDS.BIOMECHANICAL.ASYMMETRY)) {
        const alert = await this.createBiomechanicalAlert(
          sensorData,
          'ASYMMETRY',
          'Movement asymmetry detected',
          ALERT_THRESHOLDS.BIOMECHANICAL.ASYMMETRY
        );
        if (alert) alerts.push(alert);
      }

      // Log performance metrics
      const processingTime = Date.now() - startTime;
      this.logger.performance('biomechanical_analysis_latency', processingTime, {
        sensorId: sensorData.sensorId,
        alertsGenerated: alerts.length
      });

      return alerts;
    } catch (error) {
      this.logger.error('Error analyzing biomechanical data', error as Error, {
        sensorId: sensorData.sensorId
      });
      throw error;
    }
  }

  /**
   * Analyzes physiological metrics with fatigue estimation and recovery prediction
   * @param sensorData Incoming sensor data packet
   * @returns Array of physiological alerts with recovery recommendations
   */
  public async analyzePhysiologicalData(sensorData: ISensorData): Promise<IAlert[]> {
    const startTime = Date.now();
    const alerts: IAlert[] = [];

    try {
      // Validate data integrity
      if (!this.validateSensorData(sensorData)) {
        this.logger.warn('Invalid physiological data received', { sensorId: sensorData.sensorId });
        return alerts;
      }

      // Process strain metrics
      if (this.exceedsThreshold(sensorData, 'STRAIN', ALERT_THRESHOLDS.PHYSIOLOGICAL.STRAIN)) {
        const alert = await this.createPhysiologicalAlert(
          sensorData,
          'STRAIN',
          'High strain level detected',
          ALERT_THRESHOLDS.PHYSIOLOGICAL.STRAIN
        );
        if (alert) alerts.push(alert);
      }

      // Process fatigue metrics
      if (this.exceedsThreshold(sensorData, 'FATIGUE', ALERT_THRESHOLDS.PHYSIOLOGICAL.FATIGUE)) {
        const alert = await this.createPhysiologicalAlert(
          sensorData,
          'FATIGUE',
          'Elevated fatigue level detected',
          ALERT_THRESHOLDS.PHYSIOLOGICAL.FATIGUE
        );
        if (alert) alerts.push(alert);
      }

      // Log performance metrics
      const processingTime = Date.now() - startTime;
      this.logger.performance('physiological_analysis_latency', processingTime, {
        sensorId: sensorData.sensorId,
        alertsGenerated: alerts.length
      });

      return alerts;
    } catch (error) {
      this.logger.error('Error analyzing physiological data', error as Error, {
        sensorId: sensorData.sensorId
      });
      throw error;
    }
  }

  /**
   * Determines alert severity using multiple factors and historical context
   * @param value Current metric value
   * @param threshold Configured threshold value
   * @param metricType Type of metric being analyzed
   * @returns Calculated severity with confidence score
   */
  private determineAlertSeverity(value: number, threshold: number, metricType: string): ALERT_SEVERITY {
    const deviationPercent = ((value - threshold) / threshold) * 100;
    const historicalValues = this.historicalReadings.get(metricType) || [];
    
    // Calculate z-score for statistical significance
    const mean = this.calculateMean(historicalValues);
    const stdDev = this.calculateStandardDeviation(historicalValues, mean);
    const zScore = Math.abs((value - mean) / (stdDev || 1));

    if (deviationPercent >= 50 || zScore >= 3) {
      return ALERT_SEVERITY.CRITICAL;
    } else if (deviationPercent >= 25 || zScore >= 2) {
      return ALERT_SEVERITY.HIGH;
    } else if (deviationPercent >= 10 || zScore >= 1.5) {
      return ALERT_SEVERITY.MEDIUM;
    }
    return ALERT_SEVERITY.LOW;
  }

  /**
   * Validates sensor data integrity and quality
   * @param sensorData Sensor data packet to validate
   * @returns Boolean indicating data validity
   */
  private validateSensorData(sensorData: ISensorData): boolean {
    return (
      sensorData &&
      sensorData.readings &&
      sensorData.readings.length > 0 &&
      sensorData.dataQuality >= 80 // Minimum quality threshold
    );
  }

  /**
   * Checks if a metric exceeds its threshold with confidence scoring
   * @param sensorData Sensor data packet
   * @param metricType Type of metric to check
   * @param threshold Configured threshold value
   * @returns Boolean indicating threshold breach
   */
  private exceedsThreshold(sensorData: ISensorData, metricType: string, threshold: number): boolean {
    const reading = this.getMetricValue(sensorData, metricType);
    if (reading === null) return false;

    // Update historical readings
    const historicalValues = this.historicalReadings.get(metricType) || [];
    historicalValues.push(reading);
    if (historicalValues.length > this.HISTORY_WINDOW_SIZE) {
      historicalValues.shift();
    }
    this.historicalReadings.set(metricType, historicalValues);

    return reading > threshold;
  }

  /**
   * Creates a biomechanical alert with context and confidence scoring
   */
  private async createBiomechanicalAlert(
    sensorData: ISensorData,
    metricType: string,
    message: string,
    threshold: number
  ): Promise<IAlert | null> {
    const value = this.getMetricValue(sensorData, metricType);
    if (value === null) return null;

    const severity = this.determineAlertSeverity(value, threshold, metricType);
    const confidence = this.calculateConfidence(value, metricType);

    if (confidence < this.CONFIDENCE_THRESHOLD) {
      this.logger.debug('Alert suppressed due to low confidence', {
        metricType,
        confidence,
        threshold: this.CONFIDENCE_THRESHOLD
      });
      return null;
    }

    return {
      type: ALERT_TYPES.BIOMECHANICAL,
      severity,
      message,
      confidence,
      context: {
        metricType,
        currentValue: value,
        threshold,
        location: this.determineLocation(sensorData),
        timestamp: new Date()
      }
    } as IAlert;
  }

  /**
   * Creates a physiological alert with recovery recommendations
   */
  private async createPhysiologicalAlert(
    sensorData: ISensorData,
    metricType: string,
    message: string,
    threshold: number
  ): Promise<IAlert | null> {
    const value = this.getMetricValue(sensorData, metricType);
    if (value === null) return null;

    const severity = this.determineAlertSeverity(value, threshold, metricType);
    const confidence = this.calculateConfidence(value, metricType);

    if (confidence < this.CONFIDENCE_THRESHOLD) {
      return null;
    }

    return {
      type: ALERT_TYPES.PHYSIOLOGICAL,
      severity,
      message,
      confidence,
      context: {
        metricType,
        currentValue: value,
        threshold,
        recoveryRecommendation: this.generateRecoveryRecommendation(value, metricType),
        timestamp: new Date()
      }
    } as IAlert;
  }

  // Utility methods
  private calculateMean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateStandardDeviation(values: number[], mean: number): number {
    const squareDiffs = values.map(value => Math.pow(value - mean, 2));
    return Math.sqrt(squareDiffs.reduce((sum, diff) => sum + diff, 0) / values.length);
  }

  private calculateConfidence(value: number, metricType: string): number {
    const historicalValues = this.historicalReadings.get(metricType) || [];
    const mean = this.calculateMean(historicalValues);
    const stdDev = this.calculateStandardDeviation(historicalValues, mean);
    const zScore = Math.abs((value - mean) / (stdDev || 1));
    
    // Convert z-score to confidence score (0-1)
    return Math.min(Math.tanh(zScore / 2), 1);
  }

  private getMetricValue(sensorData: ISensorData, metricType: string): number | null {
    const reading = sensorData.readings.find(r => r.type === metricType);
    return reading ? reading.value[0] : null;
  }

  private determineLocation(sensorData: ISensorData): string {
    return sensorData.metadata?.location || 'Unknown';
  }

  private generateRecoveryRecommendation(value: number, metricType: string): string {
    // Implementation would include specific recovery recommendations based on
    // the metric type and severity - simplified for brevity
    return `Recovery protocol recommended for elevated ${metricType.toLowerCase()}`;
  }
}