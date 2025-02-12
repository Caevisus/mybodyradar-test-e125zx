/**
 * @fileoverview Initial database migration schema for smart apparel system
 * Implements core data models with enhanced security features and performance optimizations
 * @version 1.0.0
 */

import { Knex } from 'knex'; // ^2.5.1
import { IAthlete } from '../../interfaces/athlete.interface';
import { ITeam } from '../../interfaces/team.interface';
import { ISession } from '../../interfaces/session.interface';

/**
 * Creates initial database schema with security features and optimizations
 */
export async function up(knex: Knex): Promise<void> {
  // Enable required PostgreSQL extensions
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "timescaledb"');

  // Create athletes table with encrypted PII
  await knex.schema.createTable('athletes', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('name').notNullable();
    table.specificType('email', 'text').notNullable();
    table.jsonb('baseline_data').notNullable();
    table.jsonb('preferences').notNullable();
    table.boolean('data_encrypted').notNullable().defaultTo(true);
    table.timestamp('last_consent').notNullable();
    table.specificType('consented_purposes', 'text[]').notNullable();
    table.timestamps(true, true);

    // Add indices for common queries
    table.index(['name']);
    table.index(['email'], 'idx_athletes_email_hash', 'hash');
    table.index(['created_at']);
  });

  // Create teams table with access control
  await knex.schema.createTable('teams', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('name').notNullable();
    table.jsonb('settings').notNullable();
    table.jsonb('stats').notNullable();
    table.jsonb('access_control').notNullable();
    table.jsonb('integrations');
    table.timestamps(true, true);

    // Add indices
    table.index(['name']);
    table.index(['created_at']);
  });

  // Create sessions table optimized for time-series data
  await knex.schema.createTable('sessions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('athlete_id').notNullable().references('id').inTable('athletes');
    table.timestamp('start_time').notNullable();
    table.timestamp('end_time');
    table.string('type').notNullable();
    table.jsonb('config').notNullable();
    table.jsonb('metrics').notNullable();
    table.string('status').notNullable();
    table.timestamps(true, true);

    // Add indices for time-based queries
    table.index(['athlete_id', 'start_time']);
    table.index(['start_time', 'end_time']);
    table.index(['type', 'start_time']);
  });

  // Create sensor_data table with hypertable support
  await knex.schema.createTable('sensor_data', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('session_id').notNullable().references('id').inTable('sessions');
    table.string('sensor_id').notNullable();
    table.timestamp('timestamp').notNullable();
    table.jsonb('readings').notNullable();
    table.jsonb('metadata').notNullable();
    table.float('data_quality').notNullable();
    
    // Add indices for time-series queries
    table.index(['session_id', 'timestamp']);
    table.index(['sensor_id', 'timestamp']);
  });

  // Convert sensor_data to hypertable
  await knex.raw(`
    SELECT create_hypertable('sensor_data', 'timestamp',
      chunk_time_interval => INTERVAL '1 day',
      if_not_exists => TRUE
    );
  `);

  // Create alerts table
  await knex.schema.createTable('alerts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('session_id').notNullable().references('id').inTable('sessions');
    table.string('type').notNullable();
    table.jsonb('details').notNullable();
    table.boolean('acknowledged').notNullable().defaultTo(false);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    
    // Add indices
    table.index(['session_id', 'created_at']);
    table.index(['type', 'created_at']);
  });

  // Create athlete_team_mapping table
  await knex.schema.createTable('athlete_team_mapping', (table) => {
    table.uuid('athlete_id').notNullable().references('id').inTable('athletes');
    table.uuid('team_id').notNullable().references('id').inTable('teams');
    table.string('role').notNullable();
    table.timestamp('joined_at').notNullable();
    table.primary(['athlete_id', 'team_id']);
    
    // Add indices
    table.index(['team_id', 'role']);
  });

  // Create audit_log table
  await knex.schema.createTable('audit_log', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('action').notNullable();
    table.string('table_name').notNullable();
    table.uuid('record_id').notNullable();
    table.jsonb('old_values');
    table.jsonb('new_values');
    table.uuid('user_id').notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    
    // Add indices
    table.index(['table_name', 'record_id']);
    table.index(['created_at']);
  });

  // Create audit triggers
  await knex.raw(`
    CREATE OR REPLACE FUNCTION audit_trigger_func()
    RETURNS trigger AS $$
    BEGIN
      INSERT INTO audit_log (
        action,
        table_name,
        record_id,
        old_values,
        new_values,
        user_id
      )
      VALUES (
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
        current_setting('app.current_user_id')::uuid
      );
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Apply audit triggers to tables
  const auditedTables = ['athletes', 'teams', 'sessions'];
  for (const table of auditedTables) {
    await knex.raw(`
      CREATE TRIGGER ${table}_audit_trigger
      AFTER INSERT OR UPDATE OR DELETE ON ${table}
      FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
    `);
  }
}

/**
 * Rolls back database schema changes
 */
export async function down(knex: Knex): Promise<void> {
  // Drop audit triggers
  const auditedTables = ['athletes', 'teams', 'sessions'];
  for (const table of auditedTables) {
    await knex.raw(`DROP TRIGGER IF EXISTS ${table}_audit_trigger ON ${table}`);
  }
  
  await knex.raw('DROP FUNCTION IF EXISTS audit_trigger_func() CASCADE');

  // Drop tables in correct order
  await knex.schema.dropTableIfExists('audit_log');
  await knex.schema.dropTableIfExists('athlete_team_mapping');
  await knex.schema.dropTableIfExists('alerts');
  await knex.schema.dropTableIfExists('sensor_data');
  await knex.schema.dropTableIfExists('sessions');
  await knex.schema.dropTableIfExists('teams');
  await knex.schema.dropTableIfExists('athletes');

  // Drop extensions
  await knex.raw('DROP EXTENSION IF EXISTS "timescaledb"');
  await knex.raw('DROP EXTENSION IF EXISTS "pgcrypto"');
  await knex.raw('DROP EXTENSION IF EXISTS "uuid-ossp"');
}