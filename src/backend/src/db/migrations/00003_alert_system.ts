import { Knex } from 'knex'; // ^2.5.1
import { ALERT_TYPES, ALERT_SEVERITY } from '../../constants/alert.constants';

export async function up(knex: Knex): Promise<void> {
  // Create enum types first
  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE alert_type AS ENUM (
        '${ALERT_TYPES.BIOMECHANICAL}', 
        '${ALERT_TYPES.PHYSIOLOGICAL}', 
        '${ALERT_TYPES.PERFORMANCE}', 
        '${ALERT_TYPES.SYSTEM}'
      );
      
      CREATE TYPE alert_severity AS ENUM (
        '${ALERT_SEVERITY.LOW}', 
        '${ALERT_SEVERITY.MEDIUM}', 
        '${ALERT_SEVERITY.HIGH}', 
        '${ALERT_SEVERITY.CRITICAL}'
      );
      
      CREATE TYPE alert_status AS ENUM (
        'ACTIVE', 
        'ACKNOWLEDGED', 
        'RESOLVED', 
        'DISMISSED'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  // Create alerts table with partitioning
  await knex.schema.createTable('alerts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.specificType('type', 'alert_type').notNullable();
    table.specificType('severity', 'alert_severity').notNullable();
    table.specificType('status', 'alert_status').notNullable().defaultTo('ACTIVE');
    table.uuid('session_id').references('id').inTable('sessions').onDelete('CASCADE');
    table.uuid('sensor_id').references('id').inTable('sensor_config').onDelete('SET NULL');
    table.text('message').notNullable();
    table.jsonb('details').notNullable().defaultTo('{}');
    table.decimal('threshold_value', 10, 2);
    table.decimal('current_value', 10, 2);
    table.string('location', 100);
    table.timestamp('timestamp', { useTz: true }).notNullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // Create alert_subscriptions table
  await knex.schema.createTable('alert_subscriptions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable();
    table.specificType('alert_types', 'text[]').notNullable();
    table.specificType('min_severity', 'alert_severity').notNullable();
    table.specificType('notification_channels', 'text[]').notNullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // Create alert_notifications table
  await knex.schema.createTable('alert_notifications', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('alert_id').references('id').inTable('alerts').onDelete('CASCADE');
    table.uuid('user_id').notNullable();
    table.string('channel', 50).notNullable();
    table.string('status', 50).notNullable();
    table.timestamp('sent_at', { useTz: true });
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // Create alert_acknowledgments table
  await knex.schema.createTable('alert_acknowledgments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('alert_id').references('id').inTable('alerts').onDelete('CASCADE');
    table.uuid('user_id').notNullable();
    table.string('action', 50).notNullable();
    table.text('notes');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // Create indexes for performance optimization
  await knex.raw(`
    CREATE INDEX idx_alerts_active ON alerts (status) WHERE status = 'ACTIVE';
    CREATE INDEX idx_alerts_timestamp ON alerts (timestamp);
    CREATE INDEX idx_alerts_type_severity ON alerts (type, severity);
    CREATE INDEX idx_subs_user ON alert_subscriptions (user_id);
    CREATE INDEX idx_subs_types ON alert_subscriptions USING gin (alert_types);
    CREATE INDEX idx_notif_alert ON alert_notifications (alert_id);
    CREATE INDEX idx_notif_user ON alert_notifications (user_id);
    CREATE INDEX idx_ack_alert ON alert_acknowledgments (alert_id);
    CREATE INDEX idx_ack_user ON alert_acknowledgments (user_id);
  `);

  // Create updated_at trigger function
  await knex.raw(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ language 'plpgsql';
  `);

  // Apply updated_at triggers to all tables
  await knex.raw(`
    CREATE TRIGGER update_alerts_updated_at
      BEFORE UPDATE ON alerts
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();

    CREATE TRIGGER update_alert_subscriptions_updated_at
      BEFORE UPDATE ON alert_subscriptions
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();

    CREATE TRIGGER update_alert_notifications_updated_at
      BEFORE UPDATE ON alert_notifications
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();

    CREATE TRIGGER update_alert_acknowledgments_updated_at
      BEFORE UPDATE ON alert_acknowledgments
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `);

  // Create notification trigger
  await knex.raw(`
    CREATE OR REPLACE FUNCTION create_alert_notification()
    RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO alert_notifications (alert_id, user_id, channel, status)
      SELECT 
        NEW.id,
        s.user_id,
        unnest(s.notification_channels),
        'PENDING'
      FROM alert_subscriptions s
      WHERE NEW.type = ANY(s.alert_types)
      AND NEW.severity >= s.min_severity;
      RETURN NEW;
    END;
    $$ language 'plpgsql';

    CREATE TRIGGER trigger_alert_notification
      AFTER INSERT ON alerts
      FOR EACH ROW
      EXECUTE FUNCTION create_alert_notification();
  `);

  // Set up row-level security
  await knex.raw(`
    ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
    ALTER TABLE alert_subscriptions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE alert_notifications ENABLE ROW LEVEL SECURITY;
    ALTER TABLE alert_acknowledgments ENABLE ROW LEVEL SECURITY;

    CREATE POLICY alerts_access ON alerts
      USING (session_id IN (
        SELECT id FROM sessions WHERE team_id IN (
          SELECT team_id FROM team_members WHERE user_id = current_user_id()
        )
      ));
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop triggers first
  await knex.raw(`
    DROP TRIGGER IF EXISTS trigger_alert_notification ON alerts;
    DROP TRIGGER IF EXISTS update_alerts_updated_at ON alerts;
    DROP TRIGGER IF EXISTS update_alert_subscriptions_updated_at ON alert_subscriptions;
    DROP TRIGGER IF EXISTS update_alert_notifications_updated_at ON alert_notifications;
    DROP TRIGGER IF EXISTS update_alert_acknowledgments_updated_at ON alert_acknowledgments;
  `);

  // Drop functions
  await knex.raw(`
    DROP FUNCTION IF EXISTS create_alert_notification();
    DROP FUNCTION IF EXISTS update_updated_at_column();
  `);

  // Drop tables in correct order
  await knex.schema.dropTableIfExists('alert_acknowledgments');
  await knex.schema.dropTableIfExists('alert_notifications');
  await knex.schema.dropTableIfExists('alert_subscriptions');
  await knex.schema.dropTableIfExists('alerts');

  // Drop enum types
  await knex.raw(`
    DROP TYPE IF EXISTS alert_type;
    DROP TYPE IF EXISTS alert_severity;
    DROP TYPE IF EXISTS alert_status;
  `);
}