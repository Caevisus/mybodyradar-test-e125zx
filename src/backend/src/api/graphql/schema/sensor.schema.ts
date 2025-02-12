import { gql } from 'graphql-tag'; // v2.12.6
import { ISensorConfig, ISensorCalibrationParams } from '../../interfaces/sensor.interface';
import { SENSOR_TYPES } from '../../constants/sensor.constants';

const sensorSchema = gql`
  """
  Enumeration of supported sensor types
  """
  enum SensorType {
    IMU
    TOF
  }

  """
  Enumeration of possible sensor operational states
  """
  enum SensorStatus {
    DISCONNECTED
    CONNECTING
    CALIBRATING
    ACTIVE
    ERROR
    MAINTENANCE
  }

  """
  Scalar types for specialized data
  """
  scalar DateTime
  scalar JSON
  scalar Float

  """
  Input type for pagination control
  """
  input PaginationInput {
    offset: Int!
    limit: Int!
  }

  """
  Input type for sensor data filtering
  """
  input SensorDataFilter {
    minQuality: Float
    types: [SensorType!]
    minConfidence: Float
  }

  """
  Input type for sensor configuration
  """
  input SensorConfigInput {
    type: SensorType!
    samplingRate: Int!
    calibrationParams: CalibrationParamsInput!
  }

  """
  Input type for calibration parameters
  """
  input CalibrationParamsInput {
    tofGain: Float!
    imuDriftCorrection: Float!
    pressureThreshold: Float!
    sampleWindow: Int!
    filterCutoff: Float!
  }

  """
  Input type for maintenance scheduling
  """
  input MaintenanceInput {
    scheduledTime: DateTime!
    description: String!
    duration: Int!
  }

  """
  Type for sensor configuration data
  """
  type SensorConfig {
    id: ID!
    type: SensorType!
    samplingRate: Int!
    calibrationParams: CalibrationParams!
    lastCalibration: DateTime
    batteryLevel: Float
    firmwareVersion: String!
    status: SensorStatus!
    errorCode: Int
    maintenanceSchedule: DateTime
  }

  """
  Type for calibration parameters
  """
  type CalibrationParams {
    tofGain: Float!
    imuDriftCorrection: Float!
    pressureThreshold: Float!
    sampleWindow: Int!
    filterCutoff: Float!
    lastValidated: DateTime!
    validationScore: Float!
  }

  """
  Type for sensor reading data
  """
  type SensorReading {
    type: SensorType!
    values: [Float!]!
    timestamp: Float!
    confidence: Float!
    environmentalFactors: JSON
  }

  """
  Type for sensor metadata
  """
  type SensorMetadata {
    calibrationVersion: String!
    processingSteps: [String!]!
    quality: Float!
    sensorHealth: Float!
    environmentalConditions: JSON
  }

  """
  Type for sensor data packet
  """
  type SensorData {
    sensorId: ID!
    timestamp: Float!
    readings: [SensorReading!]!
    metadata: SensorMetadata!
    quality: Float!
    processingLatency: Float!
  }

  """
  Type for sensor data connection (pagination)
  """
  type SensorDataConnection {
    edges: [SensorData!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  """
  Type for pagination information
  """
  type PageInfo {
    hasNextPage: Boolean!
    endCursor: String!
  }

  """
  Type for calibration results
  """
  type CalibrationResult {
    success: Boolean!
    calibrationId: ID!
    timestamp: DateTime!
    params: CalibrationParams!
    quality: Float!
  }

  """
  Type for calibration progress updates
  """
  type CalibrationProgress {
    sensorId: ID!
    progress: Float!
    currentStep: String!
    estimatedTimeRemaining: Int!
  }

  """
  Type for operation results
  """
  type OperationResult {
    success: Boolean!
    message: String!
    timestamp: DateTime!
  }

  """
  Type for firmware update results
  """
  type UpdateResult {
    success: Boolean!
    version: String!
    timestamp: DateTime!
  }

  """
  Type for maintenance schedule
  """
  type MaintenanceSchedule {
    sensorId: ID!
    scheduledTime: DateTime!
    description: String!
    duration: Int!
    priority: Int!
  }

  """
  Type for sensor health report
  """
  type SensorHealthReport {
    sensorId: ID!
    overallHealth: Float!
    batteryHealth: Float!
    calibrationHealth: Float!
    connectionQuality: Float!
    lastMaintenance: DateTime
    recommendations: [String!]!
  }

  """
  Type for sensor health updates
  """
  type SensorHealthUpdate {
    sensorId: ID!
    timestamp: DateTime!
    metric: String!
    value: Float!
    status: SensorStatus!
  }

  """
  Query operations for sensor management
  """
  type Query {
    getSensorConfig(id: ID!): SensorConfig!
    getSensorStatus(id: ID!): SensorStatus!
    getSensorData(
      id: ID!
      start: Float!
      end: Float
      filter: SensorDataFilter
      pagination: PaginationInput
    ): SensorDataConnection!
    getCalibrationHistory(id: ID!): [CalibrationResult!]!
    getSensorHealth(id: ID!): SensorHealthReport!
  }

  """
  Mutation operations for sensor control
  """
  type Mutation {
    configureSensor(id: ID!, config: SensorConfigInput!): SensorConfig!
    calibrateSensor(id: ID!, params: CalibrationParamsInput!): CalibrationResult!
    startSensor(id: ID!): OperationResult!
    stopSensor(id: ID!): OperationResult!
    updateFirmware(id: ID!): UpdateResult!
    scheduleMaintenance(id: ID!, schedule: MaintenanceInput!): MaintenanceSchedule!
  }

  """
  Subscription operations for real-time data
  """
  type Subscription {
    onSensorData(id: ID!, samplingRate: Int): SensorData!
    onSensorStatusChange(id: ID!): SensorStatus!
    onCalibrationProgress(id: ID!): CalibrationProgress!
    onSensorHealth(id: ID!): SensorHealthUpdate!
  }
`;

export default sensorSchema;