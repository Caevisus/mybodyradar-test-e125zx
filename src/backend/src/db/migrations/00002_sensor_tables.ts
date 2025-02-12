import { Knex } from 'knex';
import { SENSOR_TYPES, CALIBRATION_PARAMS } from '../../constants/sensor.constants';

/**
 * Creates sensor-related database tables with optimized indexes, partitioning, and maintenance triggers
 */
export async function up(knex: Knex): Promise<void> {
  // Create enum type for sensor types
  await knex.raw(`
    CREATE TYPE sensor_type AS ENUM ('${SENSOR_TYPES.IMU}', '${SENSOR_TYPES.TOF}');
  `);

  // Create sensor_config table
  await knex.schema.createTable('sensor_config', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.specificType('type', 'sensor_type').notNullable();
    table.integer('sampling_rate').notNullable();
    table.string('firmware_version', 50);
    table.string('mac_address', 17).unique();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

    // Add index on mac_address for quick lookups
    table.index(['mac_address'], 'idx_sensor_config_mac');
  });

  // Create sensor_calibration table with range constraints
  await knex.schema.createTable('sensor_calibration', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('sensor_id').references('id').inTable('sensor_config').onDelete('CASCADE');
    table.integer('tof_gain').checkBetween([
      CALIBRATION_PARAMS.tofGainRange.min,
      CALIBRATION_PARAMS.tofGainRange.max
    ]);
    table.decimal('imu_drift_correction', 3, 1).checkBetween([
      CALIBRATION_PARAMS.imuDriftCorrection.min,
      CALIBRATION_PARAMS.imuDriftCorrection.max
    ]);
    table.decimal('pressure_threshold', 3, 1).checkBetween([
      CALIBRATION_PARAMS.pressureThreshold.min,
      CALIBRATION_PARAMS.pressureThreshold.max
    ]);
    table.integer('sample_window').checkBetween([
      CALIBRATION_PARAMS.sampleWindow.min,
      CALIBRATION_PARAMS.sampleWindow.max
    ]);
    table.decimal('filter_cutoff', 3, 1).checkBetween([
      CALIBRATION_PARAMS.filterCutoff.min,
      CALIBRATION_PARAMS.filterCutoff.max
    ]);
    table.timestamp('last_calibration', { useTz: true });
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

    // Add index on sensor_id for quick lookups
    table.index(['sensor_id'], 'idx_sensor_calibration_sensor');
  });

  // Create partitioned sensor_measurements table
  await knex.raw(`
    CREATE TABLE sensor_measurements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sensor_id UUID REFERENCES sensor_config(id),
      timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
      data JSONB NOT NULL,
      session_id UUID,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
      partition_key TIMESTAMP WITH TIME ZONE GENERATED ALWAYS AS (date_trunc('day', timestamp)) STORED
    ) PARTITION BY RANGE (partition_key);

    -- Create partitions for current month and next month
    CREATE TABLE sensor_measurements_current PARTITION OF sensor_measurements
    FOR VALUES FROM (date_trunc('month', now()))
    TO (date_trunc('month', now() + interval '1 month'));

    CREATE TABLE sensor_measurements_next PARTITION OF sensor_measurements
    FOR VALUES FROM (date_trunc('month', now() + interval '1 month'))
    TO (date_trunc('month', now() + interval '2 months'));

    -- Create indexes on partitioned table
    CREATE INDEX idx_sensor_measurements_timestamp ON sensor_measurements (timestamp);
    CREATE INDEX idx_sensor_measurements_sensor ON sensor_measurements (sensor_id);
    CREATE INDEX idx_sensor_measurements_session ON sensor_measurements (session_id);
  `);

  // Create sensor_status table
  await knex.schema.createTable('sensor_status', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('sensor_id').references('id').inTable('sensor_config').onDelete('CASCADE');
    table.integer('status').notNullable();
    table.integer('battery_level');
    table.timestamp('last_seen', { useTz: true });
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

    // Add indexes for monitoring queries
    table.index(['sensor_id', 'status'], 'idx_sensor_status_monitoring');
    table.index(['last_seen'], 'idx_sensor_status_last_seen');
  });

  // Create updated_at trigger function
  await knex.raw(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ language 'plpgsql';
  `);

  // Add updated_at triggers to all tables
  const tables = ['sensor_config', 'sensor_calibration', 'sensor_status'];
  for (const table of tables) {
    await knex.raw(`
      CREATE TRIGGER update_${table}_updated_at
        BEFORE UPDATE ON ${table}
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);
  }

  // Create maintenance function for partition management
  await knex.raw(`
    CREATE OR REPLACE FUNCTION maintain_sensor_measurements_partitions()
    RETURNS void AS $$
    DECLARE
      future_partition_date timestamp;
    BEGIN
      future_partition_date := date_trunc('month', now() + interval '2 months');
      
      EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sensor_measurements_future PARTITION OF sensor_measurements
         FOR VALUES FROM (%L)
         TO (%L)',
        future_partition_date,
        future_partition_date + interval '1 month'
      );
    END;
    $$ LANGUAGE plpgsql;

    -- Create scheduled job for partition maintenance
    SELECT cron.schedule('0 0 1 * *', $$SELECT maintain_sensor_measurements_partitions()$$);
  `);

  // Set up retention policy for old partitions
  await knex.raw(`
    CREATE OR REPLACE FUNCTION cleanup_old_sensor_measurements()
    RETURNS void AS $$
    BEGIN
      DROP TABLE IF EXISTS sensor_measurements_old;
      -- Keep only last 6 months of data in hot storage
      DELETE FROM sensor_measurements
      WHERE timestamp < now() - interval '6 months';
    END;
    $$ LANGUAGE plpgsql;

    -- Schedule cleanup job
    SELECT cron.schedule('0 0 * * 0', $$SELECT cleanup_old_sensor_measurements()$$);
  `);
}

/**
 * Drops all sensor-related tables and supporting objects
 */
export async function down(knex: Knex): Promise<void> {
  // Remove scheduled jobs
  await knex.raw(`
    SELECT cron.unschedule('maintain_sensor_measurements_partitions');
    SELECT cron.unschedule('cleanup_old_sensor_measurements');
  `);

  // Drop functions
  await knex.raw(`
    DROP FUNCTION IF EXISTS cleanup_old_sensor_measurements();
    DROP FUNCTION IF EXISTS maintain_sensor_measurements_partitions();
    DROP FUNCTION IF EXISTS update_updated_at_column();
  `);

  // Drop tables in correct order
  await knex.schema
    .dropTableIfExists('sensor_measurements_current')
    .dropTableIfExists('sensor_measurements_next')
    .dropTableIfExists('sensor_measurements')
    .dropTableIfExists('sensor_status')
    .dropTableIfExists('sensor_calibration')
    .dropTableIfExists('sensor_config');

  // Drop custom types
  await knex.raw(`DROP TYPE IF EXISTS sensor_type`);
}