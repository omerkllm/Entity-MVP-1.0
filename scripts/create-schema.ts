/**
 * create-schema.ts — idempotent DDL script for the Entity supply-chain database.
 *
 * Creates all tables in dependency order.
 * Safe to re-run: every statement uses IF NOT EXISTS / IF EXISTS guards.
 *
 * Usage:
 *   npx tsx scripts/create-schema.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local before connecting
config({ path: resolve(process.cwd(), '.env.local') });

import { Pool } from 'pg';

async function createSchema() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Add it to .env.local');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ── 1. processes ──────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS processes (
        process_id   VARCHAR(10)  PRIMARY KEY,
        name         VARCHAR(100) NOT NULL,
        status       VARCHAR(20)  NOT NULL DEFAULT 'Active',
        quantity     INTEGER      NOT NULL DEFAULT 0,
        unit         VARCHAR(10)  NOT NULL DEFAULT '',
        last_updated DATE,
        next_process VARCHAR(10)  REFERENCES processes(process_id)
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_processes_next ON processes (next_process);
    `);
    console.log('✓ processes');

    // ── 2. category ───────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS category (
        category_id VARCHAR(10)  PRIMARY KEY,
        name        VARCHAR(150) NOT NULL,
        process_id  VARCHAR(10)  NOT NULL REFERENCES processes(process_id)
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_category_process ON category (process_id);
    `);
    console.log('✓ category');

    // ── 3. businesses ─────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS businesses (
        business_id     VARCHAR(10)  PRIMARY KEY,
        object_category VARCHAR(150) NOT NULL,
        region          VARCHAR(100) NOT NULL,
        coordinates     VARCHAR(50)  NOT NULL
      );
    `);
    console.log('✓ businesses');

    // ── 4. warehouse  (timeline_id column added without FK — resolved below) ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS warehouse (
        warehouse_id        VARCHAR(10)   PRIMARY KEY,
        title               VARCHAR(100)  NOT NULL,
        region              VARCHAR(100)  NOT NULL,
        coordinates         VARCHAR(50)   NOT NULL,
        object_category     VARCHAR(150),
        operational_hours   VARCHAR(20),
        status              VARCHAR(10)   NOT NULL CHECK (status IN ('Open', 'Closed')),
        total_capacity      INTEGER       NOT NULL CHECK (total_capacity > 0),
        capacity_used       INTEGER       NOT NULL DEFAULT 0 CHECK (capacity_used >= 0),
        capacity_pct        DECIMAL(5,4)  GENERATED ALWAYS AS (
                              CASE WHEN total_capacity > 0
                                   THEN CAST(capacity_used AS DECIMAL) / total_capacity
                                   ELSE 0 END
                            ) STORED,
        business_link_type  VARCHAR(20),
        category_id         VARCHAR(10)   REFERENCES category(category_id),
        business_id         VARCHAR(10)   REFERENCES businesses(business_id),
        timeline_id         VARCHAR(20)   DEFAULT NULL
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_wh_business  ON warehouse (business_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_wh_category  ON warehouse (category_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_wh_status    ON warehouse (status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_wh_timeline  ON warehouse (timeline_id);`);
    console.log('✓ warehouse');

    // ── 5. object ─────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS object (
        object_id       VARCHAR(15)  PRIMARY KEY,
        object_category VARCHAR(200) NOT NULL,
        quantity        INT          NOT NULL CHECK (quantity >= 0),
        unit            VARCHAR(30)  NOT NULL,
        arrival_time    TIMESTAMP    NOT NULL,
        transit_status  VARCHAR(20)  NOT NULL,
        object_health   VARCHAR(10)  NOT NULL,
        warehouse_id    VARCHAR(10)  NOT NULL REFERENCES warehouse(warehouse_id)
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_obj_warehouse ON object (warehouse_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_obj_transit   ON object (transit_status);`);
    console.log('✓ object');

    // ── 6. timeline ───────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS timeline (
        timeline_id  VARCHAR(20) PRIMARY KEY,
        object_id    VARCHAR(15) NOT NULL REFERENCES object(object_id),
        arrival_time TIMESTAMP   NOT NULL,
        quantity     INT         NOT NULL CHECK (quantity >= 0)
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tl_object  ON timeline (object_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tl_arrival ON timeline (arrival_time DESC);`);
    console.log('✓ timeline');

    // ── 7. Resolve circular FK: warehouse.timeline_id → timeline ─────────────
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE warehouse
          ADD CONSTRAINT fk_warehouse_timeline_id
          FOREIGN KEY (timeline_id) REFERENCES timeline(timeline_id);
      EXCEPTION
        WHEN duplicate_object THEN NULL;  -- constraint already exists, skip
      END $$;
    `);
    console.log('✓ warehouse.timeline_id FK');

    // ── 8. activity_log ───────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id         SERIAL       PRIMARY KEY,
        node_id    VARCHAR(10)  NOT NULL REFERENCES processes(process_id),
        event_type VARCHAR(200) NOT NULL,
        time       VARCHAR(50)  NOT NULL
      );
    `);
    console.log('✓ activity_log');

    // ── 9. users ──────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        email           VARCHAR(255) NOT NULL UNIQUE,
        username        VARCHAR(50)  NOT NULL UNIQUE,
        password_hash   VARCHAR(255) NOT NULL,
        role            VARCHAR(10)  NOT NULL,
        is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
        failed_attempts INTEGER      NOT NULL DEFAULT 0,
        locked_until    TIMESTAMPTZ,
        mfa_secret      VARCHAR(100)
      );
    `);
    console.log('✓ users');

    await client.query('COMMIT');
    console.log('\n✅ Schema created — all tables are ready.\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n✗ Schema creation failed, rolled back.\n');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

createSchema().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
