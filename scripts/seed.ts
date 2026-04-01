/**
 * Seed script — reads all JSON data files and populates PostgreSQL.
 *
 * Features:
 *   • Multi-row bulk INSERTs (batched, configurable chunk size)
 *   • Per-batch SAVEPOINT isolation — a failing batch is logged and skipped
 *   • Correct FK insertion order: processes → categories → businesses → warehouses → objects → activity_log → users
 *   • Parallel bcrypt hashing for seed users
 *
 * Usage (from entity/ directory):
 *   npm run seed
 *
 * Requires DATABASE_URL in .env.local
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local before anything else
config({ path: resolve(process.cwd(), '.env.local') });

import { Pool, type PoolClient } from 'pg';
import { readFileSync } from 'fs';
import bcrypt from '@node-rs/bcrypt';

// ─── Configuration ───────────────────────────────────────────────────────────

const BATCH_SIZE = 100;
const BCRYPT_ROUNDS = 12;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProcessNode {
  id: string;
  name: string;
  status: 'Active' | 'Pending';
  quantity: number;
  unit: string;
  lastUpdated: string;
}

interface ActivityEntry {
  nodeId: string;
  eventType: string;
  time: string;
}

interface WarehouseRelation {
  warehouseId: string;
  objectCategory: string;
  businessLinkType: 'Supplier' | 'Customer' | null;
  processId: string;
}

interface WarehousingEntry {
  warehouseId: string;
  title: string;
  usedCapacity: number;
  totalCapacity: number;
  region: string;
  status: 'Open' | 'Closed';
  coordinates: string;
  hours: string;
}

interface ObjectEntry {
  objectId: string;
  quantity: number;
  unit: string;
  transitStatus: string;
  objectHealth: string;
  arrivalTime: string;
}

interface ObjectRelation {
  objectId: string;
  warehouseId: string;
  objectCategory: string;
}

interface BusinessEntry {
  businessId: string;
  objectCategory: string;
  region: string;
  coordinates: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DATA = resolve(process.cwd(), 'scripts', 'seed-data');

function load<T>(file: string): T {
  return JSON.parse(readFileSync(resolve(DATA, file), 'utf-8')) as T;
}

/** Split an array into chunks of at most `size` elements. */
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Build a multi-row INSERT statement:
 *   INSERT INTO <table> (<cols>) VALUES ($1,$2,...), ($3,$4,...), ...
 *
 * Returns { text, params } ready for client.query().
 */
function buildBulkInsert(
  table: string,
  columns: string[],
  rows: unknown[][],
): { text: string; params: unknown[] } {
  const colCount = columns.length;
  const valueClauses: string[] = [];
  const params: unknown[] = [];

  for (let r = 0; r < rows.length; r++) {
    const placeholders: string[] = [];
    for (let c = 0; c < colCount; c++) {
      params.push(rows[r][c]);
      placeholders.push(`$${r * colCount + c + 1}`);
    }
    valueClauses.push(`(${placeholders.join(',')})`);
  }

  const text = `INSERT INTO ${table} (${columns.join(',')}) VALUES ${valueClauses.join(',')}`;
  return { text, params };
}

/**
 * Execute a bulk insert in batches with per-batch SAVEPOINT isolation.
 * Failed batches are logged (with the first/last ID from `idKey`) and skipped.
 * Returns the total number of successfully inserted rows.
 */
async function batchInsert(
  client: PoolClient,
  label: string,
  table: string,
  columns: string[],
  allRows: unknown[][],
  idKey?: { index: number },
): Promise<number> {
  const batches = chunk(allRows, BATCH_SIZE);
  let inserted = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchNum = i + 1;
    const sp = `sp_${label}_${batchNum}`;

    try {
      await client.query(`SAVEPOINT ${sp}`);
      const { text, params } = buildBulkInsert(table, columns, batch);
      await client.query(text, params);
      await client.query(`RELEASE SAVEPOINT ${sp}`);
      inserted += batch.length;
    } catch (err) {
      await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
      const first = idKey ? batch[0]?.[idKey.index] : '?';
      const last  = idKey ? batch[batch.length - 1]?.[idKey.index] : '?';
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ ${label} batch ${batchNum}/${batches.length} failed (${first}..${last}): ${msg}`);
    }
  }

  const total = batches.length;
  console.log(`✓ Inserted ${inserted}/${allRows.length} ${label} (${total} batch${total !== 1 ? 'es' : ''})`);
  return inserted;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Add it to entity/.env.local');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ── Schema migration (idempotent) ─────────────────────────────────────────
    await client.query(`
      ALTER TABLE processes ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'Active';
      ALTER TABLE processes ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE processes ADD COLUMN IF NOT EXISTS unit VARCHAR(10) NOT NULL DEFAULT '';
      ALTER TABLE processes ADD COLUMN IF NOT EXISTS last_updated DATE;
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id            SERIAL PRIMARY KEY,
        node_id       VARCHAR(10) NOT NULL REFERENCES processes(process_id),
        event_type    VARCHAR(200) NOT NULL,
        time          VARCHAR(50) NOT NULL
      );
    `);
    console.log('✓ Schema migration applied');

    // ── Clear existing domain data (safe to re-run) ──────────────────────────
    await client.query(
      `TRUNCATE timeline, object, warehouse, category, processes, businesses, activity_log
       RESTART IDENTITY CASCADE`
    );
    console.log('✓ Tables cleared');

    // ── 1. Processes (8 rows — bulk insert, then chain-link next_process) ────
    const nodes = load<ProcessNode[]>('supply-chain-nodes.json');
    const chain = [
      'PRC-01', 'PRC-02', 'PRC-03', 'PRC-04',
      'PRC-05', 'PRC-06', 'PRC-07', 'PRC-08',
    ];

    const processRows: unknown[][] = [];
    for (const id of chain) {
      const node = nodes.find(n => n.id === id);
      if (!node) throw new Error(`Process node ${id} not found in supply-chain-nodes.json`);
      processRows.push([node.id, node.name, node.status, node.quantity, node.unit, node.lastUpdated]);
    }

    const { text: procText, params: procParams } = buildBulkInsert(
      'processes',
      ['process_id', 'name', 'status', 'quantity', 'unit', 'last_updated'],
      processRows,
    );
    await client.query(`${procText} ON CONFLICT (process_id) DO NOTHING`, procParams);

    // Link the chain: PRC-01 → PRC-02 → … → PRC-08
    for (let i = 0; i < chain.length - 1; i++) {
      await client.query(
        'UPDATE processes SET next_process=$1 WHERE process_id=$2',
        [chain[i + 1], chain[i]],
      );
    }
    console.log(`✓ Inserted ${chain.length} processes`);

    // ── 2. Categories (unique objectCategory × processId pairs) ──────────────
    const whRel = load<WarehouseRelation[]>('warehouse-relationships.json');
    const catMap = new Map<string, string>(); // "name|processId" → "CAT-NNN"
    let catCounter = 1;

    for (const w of whRel) {
      const key = `${w.objectCategory}|${w.processId}`;
      if (!catMap.has(key)) {
        catMap.set(key, `CAT-${String(catCounter++).padStart(3, '0')}`);
      }
    }

    const categoryRows: unknown[][] = [];
    for (const [key, catId] of catMap) {
      const pipeIdx = key.indexOf('|');
      categoryRows.push([catId, key.slice(0, pipeIdx), key.slice(pipeIdx + 1)]);
    }
    await batchInsert(client, 'categories', 'category', ['category_id', 'name', 'process_id'], categoryRows, { index: 0 });

    // ── 3. Businesses ────────────────────────────────────────────────────────
    const businessData = load<BusinessEntry[]>('businesses.json');
    const businessRows = businessData.map(b => [b.businessId, b.objectCategory, b.region, b.coordinates]);
    await batchInsert(client, 'businesses', 'businesses', ['business_id', 'object_category', 'region', 'coordinates'], businessRows, { index: 0 });

    // Map process prefix → business IDs for warehouse linkage
    const processToBiz: Record<string, string[]> = {
      'PRC-01': ['BIZ-C01', 'BIZ-C02', 'BIZ-C03'],
      'PRC-02': ['BIZ-R01', 'BIZ-R02', 'BIZ-R03'],
      'PRC-03': ['BIZ-S01', 'BIZ-S02', 'BIZ-S03'],
      'PRC-04': ['BIZ-K01', 'BIZ-K02', 'BIZ-K03'],
      'PRC-05': ['BIZ-W01', 'BIZ-W02', 'BIZ-W03'],
      'PRC-06': ['BIZ-D01', 'BIZ-D02', 'BIZ-D03'],
      'PRC-07': ['BIZ-G01', 'BIZ-G02', 'BIZ-G03'],
      'PRC-08': ['BIZ-E01', 'BIZ-E02', 'BIZ-E03'],
    };

    // ── 4. Warehouses ─────────────────────────────────────────────────────────
    const whData = load<WarehousingEntry[]>('warehousing-data.json');
    const bizRoundRobin: Record<string, number> = {};
    const warehouseRows: unknown[][] = [];

    for (const wh of whData) {
      const rel = whRel.find(r => r.warehouseId === wh.warehouseId);
      if (!rel) {
        console.warn(`  ⚠ No relationship for warehouse ${wh.warehouseId} — skipping`);
        continue;
      }

      const catKey = `${rel.objectCategory}|${rel.processId}`;
      const catId = catMap.get(catKey)!;
      const coords = wh.coordinates.replace(/°/g, '');
      const hours = wh.hours.replace(' → ', '-');

      let bizId: string | null = null;
      if (rel.businessLinkType) {
        const bizPool = processToBiz[rel.processId] ?? [];
        if (bizPool.length > 0) {
          const idx = bizRoundRobin[rel.processId] ?? 0;
          bizId = bizPool[idx % bizPool.length];
          bizRoundRobin[rel.processId] = idx + 1;
        }
      }

      warehouseRows.push([
        wh.warehouseId, wh.title, wh.region, coords, rel.objectCategory,
        hours, wh.status, wh.totalCapacity, 0 /* capacity_used seeded as 0 */,
        rel.businessLinkType ?? null, bizId, catId, null,
      ]);
    }

    await batchInsert(
      client, 'warehouses', 'warehouse',
      ['warehouse_id', 'title', 'region', 'coordinates', 'object_category',
       'operational_hours', 'status', 'total_capacity', 'capacity_used',
       'business_link_type', 'business_id', 'category_id', 'timeline_id'],
      warehouseRows,
      { index: 0 },
    );

    // ── 5. Objects ────────────────────────────────────────────────────────────
    const objects = load<ObjectEntry[]>('objects-data.json');
    const objRelArr = load<ObjectRelation[]>('object-relationships.json');
    const objRelMap = new Map<string, ObjectRelation>(
      objRelArr.map(r => [r.objectId, r]),
    );

    const objectRows: unknown[][] = [];
    for (const obj of objects) {
      const rel = objRelMap.get(obj.objectId);
      if (!rel) {
        console.warn(`  ⚠ No relationship for object ${obj.objectId} — skipping`);
        continue;
      }
      objectRows.push([
        obj.objectId, rel.objectCategory, obj.quantity, obj.unit,
        obj.arrivalTime, obj.transitStatus, obj.objectHealth, rel.warehouseId,
      ]);
    }

    await batchInsert(
      client, 'objects', 'object',
      ['object_id', 'object_category', 'quantity', 'unit',
       'arrival_time', 'transit_status', 'object_health', 'warehouse_id'],
      objectRows,
      { index: 0 },
    );

    // Sync the stored capacity_used column so the GENERATED capacity_pct is accurate
    await client.query(`
      UPDATE warehouse
      SET capacity_used = COALESCE((
        SELECT SUM(quantity) FROM object WHERE warehouse_id = warehouse.warehouse_id
      ), 0)
    `);
    console.log('✓ Updated warehouse capacity_used from live object quantities');

    // ── 6. Seed users (parallel hashing, upsert) ─────────────────────────────
    const seedUsers = [
      { email: 'admin@entity.com',    username: 'admin',    role: 'SA',  password: '123' },
      { email: 'analyst@entity.com',  username: 'analyst',  role: 'SCA', password: '123' },
      { email: 'commander@entity.com',username: 'commander',role: 'SC',  password: '123' },
      { email: 'operator@entity.com', username: 'operator', role: 'WO',  password: '123' },
    ];

    const hashes = await Promise.all(seedUsers.map(u => bcrypt.hash(u.password, BCRYPT_ROUNDS)));
    const userRows = seedUsers.map((u, i) => [u.email, u.username, hashes[i], u.role]);
    const { text: userText, params: userParams } = buildBulkInsert(
      'users', ['email', 'username', 'password_hash', 'role'], userRows,
    );
    await client.query(
      `${userText} ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      userParams,
    );
    for (const u of seedUsers) {
      console.log(`✔ Seed user: ${u.email} / ${u.password} [${u.role}]`);
    }

    // ── 7. Activity Log ──────────────────────────────────────────────────────
    const activityEntries = load<ActivityEntry[]>('activity-log.json');
    const activityRows = activityEntries.map(e => [e.nodeId, e.eventType, e.time]);
    await batchInsert(client, 'activity_log', 'activity_log', ['node_id', 'event_type', 'time'], activityRows);

    await client.query('COMMIT');
    console.log('\n✅ Seed complete — database is ready.\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n✗ Seed failed, rolled back.\n');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
