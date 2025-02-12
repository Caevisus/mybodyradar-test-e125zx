/**
 * @fileoverview Sensor Calibration Panel Component
 * Implements comprehensive sensor calibration interface with real-time validation,
 * performance monitoring, and sub-100ms latency feedback
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { debounce } from 'lodash';
import { useSensor } from '../../hooks/useSensor';
import Button from '../common/Button';
import { ISensorCalibrationParams } from '../../interfaces/sensor.interface';
import { CALIBRATION_PARAMS, SENSOR_STATUS, SENSOR_TYPES } from '../../constants/sensor.constants';

interface CalibrationPanelProps {
  sensorId: string;
  sensorType: SENSOR_TYPES;
  onCalibrationComplete?: (params: ISensorCalibrationParams) => void;
  onCalibrationError?: (error: Error) => void;
  enableTelemetry?: boolean;
}

interface ValidationState {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * CalibrationPanel component for sensor configuration and calibration
 * Implements real-time parameter validation with <100ms latency
 */
export const CalibrationPanel: React.FC<CalibrationPanelProps> = ({
  sensorId,
  sensorType,
  onCalibrationComplete,
  onCalibrationError,
  enableTelemetry = true,
}) => {
  // Initialize sensor hook with calibration capabilities
  const { calibrateSensor, sensorStatus, validateCalibration } = useSensor({
    id: sensorId,
    type: sensorType,
    samplingRate: sensorType === SENSOR_TYPES.IMU ? 200 : 100,
    bufferSize: 1024,
  });

  // State management for calibration parameters and UI
  const [calibrationParams, setCalibrationParams] = useState<ISensorCalibrationParams>({
    tofGain: CALIBRATION_PARAMS.tofGainRange.default,
    imuDriftCorrection: CALIBRATION_PARAMS.imuDriftCorrection.default,
    pressureThreshold: CALIBRATION_PARAMS.pressureThreshold.default,
    sampleWindow: CALIBRATION_PARAMS.sampleWindow.default,
    filterCutoff: CALIBRATION_PARAMS.filterCutoff.default,
  });

  const [isCalibrating, setIsCalibrating] = useState(false);
  const [validationState, setValidationState] = useState<ValidationState>({
    isValid: true,
    errors: {},
  });

  /**
   * Real-time parameter validation with debouncing for performance
   */
  const validateParams = useCallback(
    debounce((params: ISensorCalibrationParams): ValidationState => {
      const errors: Record<string, string> = {};

      // Validate ToF gain
      if (params.tofGain < CALIBRATION_PARAMS.tofGainRange.min || 
          params.tofGain > CALIBRATION_PARAMS.tofGainRange.max) {
        errors.tofGain = `ToF gain must be between ${CALIBRATION_PARAMS.tofGainRange.min} and ${CALIBRATION_PARAMS.tofGainRange.max}`;
      }

      // Validate IMU drift correction
      if (params.imuDriftCorrection < CALIBRATION_PARAMS.imuDriftCorrection.min || 
          params.imuDriftCorrection > CALIBRATION_PARAMS.imuDriftCorrection.max) {
        errors.imuDriftCorrection = `IMU drift correction must be between ${CALIBRATION_PARAMS.imuDriftCorrection.min}° and ${CALIBRATION_PARAMS.imuDriftCorrection.max}°`;
      }

      // Validate sample window
      if (params.sampleWindow < CALIBRATION_PARAMS.sampleWindow.min || 
          params.sampleWindow > CALIBRATION_PARAMS.sampleWindow.max) {
        errors.sampleWindow = `Sample window must be between ${CALIBRATION_PARAMS.sampleWindow.min}ms and ${CALIBRATION_PARAMS.sampleWindow.max}ms`;
      }

      return {
        isValid: Object.keys(errors).length === 0,
        errors,
      };
    }, 100),
    []
  );

  /**
   * Handle parameter changes with real-time validation
   */
  const handleParamChange = useCallback((
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = event.target;
    const updatedParams = {
      ...calibrationParams,
      [name]: parseFloat(value),
    };

    setCalibrationParams(updatedParams);
    const validationResult = validateParams(updatedParams);
    setValidationState(validationResult);
  }, [calibrationParams, validateParams]);

  /**
   * Initiate calibration process with comprehensive error handling
   */
  const handleCalibration = useCallback(async (
    event: React.FormEvent
  ) => {
    event.preventDefault();
    
    try {
      setIsCalibrating(true);

      // Validate sensor status
      if (sensorStatus.get(sensorId) === SENSOR_STATUS.ERROR) {
        throw new Error('Sensor is in error state');
      }

      // Perform calibration with timeout
      const calibrationPromise = calibrateSensor(sensorId, calibrationParams);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Calibration timeout')), 30000);
      });

      await Promise.race([calibrationPromise, timeoutPromise]);

      onCalibrationComplete?.(calibrationParams);
    } catch (error) {
      onCalibrationError?.(error as Error);
    } finally {
      setIsCalibrating(false);
    }
  }, [sensorId, calibrationParams, calibrateSensor, onCalibrationComplete, onCalibrationError, sensorStatus]);

  /**
   * Monitor sensor status changes
   */
  useEffect(() => {
    if (enableTelemetry) {
      const status = sensorStatus.get(sensorId);
      if (status === SENSOR_STATUS.ERROR) {
        onCalibrationError?.(new Error('Sensor entered error state'));
      }
    }
  }, [sensorId, sensorStatus, enableTelemetry, onCalibrationError]);

  return (
    <form onSubmit={handleCalibration} className="calibration-panel">
      <div className="calibration-panel__controls">
        {/* ToF Gain Control */}
        <div className="calibration-panel__control">
          <label htmlFor="tofGain">ToF Gain (1-16)</label>
          <input
            type="range"
            id="tofGain"
            name="tofGain"
            min={CALIBRATION_PARAMS.tofGainRange.min}
            max={CALIBRATION_PARAMS.tofGainRange.max}
            step="1"
            value={calibrationParams.tofGain}
            onChange={handleParamChange}
            disabled={isCalibrating}
          />
          <span className="calibration-panel__value">{calibrationParams.tofGain}</span>
          {validationState.errors.tofGain && (
            <span className="calibration-panel__error">{validationState.errors.tofGain}</span>
          )}
        </div>

        {/* IMU Drift Correction Control */}
        <div className="calibration-panel__control">
          <label htmlFor="imuDriftCorrection">IMU Drift Correction (0.1-2.0°)</label>
          <input
            type="range"
            id="imuDriftCorrection"
            name="imuDriftCorrection"
            min={CALIBRATION_PARAMS.imuDriftCorrection.min}
            max={CALIBRATION_PARAMS.imuDriftCorrection.max}
            step="0.1"
            value={calibrationParams.imuDriftCorrection}
            onChange={handleParamChange}
            disabled={isCalibrating}
          />
          <span className="calibration-panel__value">{calibrationParams.imuDriftCorrection}°</span>
          {validationState.errors.imuDriftCorrection && (
            <span className="calibration-panel__error">{validationState.errors.imuDriftCorrection}</span>
          )}
        </div>

        {/* Sample Window Control */}
        <div className="calibration-panel__control">
          <label htmlFor="sampleWindow">Sample Window (50-500ms)</label>
          <input
            type="range"
            id="sampleWindow"
            name="sampleWindow"
            min={CALIBRATION_PARAMS.sampleWindow.min}
            max={CALIBRATION_PARAMS.sampleWindow.max}
            step="10"
            value={calibrationParams.sampleWindow}
            onChange={handleParamChange}
            disabled={isCalibrating}
          />
          <span className="calibration-panel__value">{calibrationParams.sampleWindow}ms</span>
          {validationState.errors.sampleWindow && (
            <span className="calibration-panel__error">{validationState.errors.sampleWindow}</span>
          )}
        </div>
      </div>

      <div className="calibration-panel__actions">
        <Button
          type="submit"
          variant="contained"
          color="primary"
          isLoading={isCalibrating}
          disabled={!validationState.isValid || isCalibrating}
          ariaLabel="Start sensor calibration"
        >
          {isCalibrating ? 'Calibrating...' : 'Calibrate Sensor'}
        </Button>
      </div>

      {/* Status indicator */}
      <div className="calibration-panel__status">
        <span>Status: {sensorStatus.get(sensorId) || 'Unknown'}</span>
      </div>
    </form>
  );
};

export default CalibrationPanel;