# Database Layer

## Current Schema Reference

The Parser Agent reads from and writes to these existing tables:

| Table | Primary Key | Key Columns | Agent Usage |
|---|---|---|---|
| `processes` | `process_id` (VARCHAR) | name, status, quantity, unit, last_updated | Read: context. Write: update quantity/status on commit. |
| `category` | `category_id` (VARCHAR) | name, process_id FK | Read only: resolve object category names → IDs |
| `businesses` | `business_id` (VARCHAR) | object_category, region, coordinates (DOUBLE[]) | Read: supplier lookup, geo proximity. Write: rare. |
| `warehouse` | `warehouse_id` (VARCHAR) | title, region, coordinates, object_category, status, total_capacity, capacity_used, business_link_type, category_id FK, business_id FK | Read: capacity checks. Write: update capacity_used, status. |
| `object` | `object_id` (VARCHAR) | object_category, quantity, unit, arrival_time, transit_status, object_health, warehouse_id FK | Read: inventory queries. Write: insert new objects, update transit_status. |
| `activity_log` | `id` (SERIAL) | node_id, event_type, time | Write: log every simulation commit |
| `users` | `user_id` (UUID) | email, username, role, is_active | Read only: verify role for authorization |

---

## Schema Extensions

### New Table: `simulation_sessions`

Tracks active and historical simulations:

```sql
CREATE TABLE IF NOT EXISTS simulation_sessions (
  session_id    VARCHAR(12) PRIMARY KEY,    -- first 6 chars of conversation UUID
  user_id       UUID NOT NULL REFERENCES users(user_id),
  status        VARCHAR(20) NOT NULL DEFAULT 'active',
                -- 'active', 'committed', 'cancelled', 'expired'
  intent_json   JSONB NOT NULL,             -- structured intent from NLU
  options_json  JSONB NOT NULL,             -- array of generated options with metadata
  chosen_option VARCHAR(10),                -- 'opt_a', 'opt_b', or 'opt_c'
  view_names    TEXT[] NOT NULL DEFAULT '{}', -- list of created view names for cleanup
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at   TIMESTAMPTZ,               -- when committed/cancelled/expired
  CONSTRAINT valid_status CHECK (status IN ('active', 'committed', 'cancelled', 'expired'))
);

CREATE INDEX idx_sim_sessions_status ON simulation_sessions(status) WHERE status = 'active';
CREATE INDEX idx_sim_sessions_user ON simulation_sessions(user_id);
```

### New Table: `simulation_mutations`

Stores the planned SQL mutations for each option so `@proceed` can replay them:

```sql
CREATE TABLE IF NOT EXISTS simulation_mutations (
  id            SERIAL PRIMARY KEY,
  session_id    VARCHAR(12) NOT NULL REFERENCES simulation_sessions(session_id),
  option_id     VARCHAR(10) NOT NULL,       -- 'opt_a', 'opt_b', 'opt_c'
  table_name    VARCHAR(50) NOT NULL,       -- target real table
  operation     VARCHAR(10) NOT NULL,       -- 'INSERT' or 'UPDATE'
  query_text    TEXT NOT NULL,              -- parameterised SQL template
  query_params  JSONB NOT NULL,             -- parameter values array
  sort_order    INT NOT NULL DEFAULT 0,     -- execution order within option
  CONSTRAINT valid_operation CHECK (operation IN ('INSERT', 'UPDATE'))
);

CREATE INDEX idx_sim_mutations_session ON simulation_mutations(session_id, option_id);
```

---

## SQL Generation Safety

### Allowlist Approach

The Query Planner can only produce these statement types:

| Statement | Context | Guarded by |
|---|---|---|
| `SELECT` | Free-text queries, option preview | Always allowed |
| `CREATE VIEW` | Simulation branches | Only during `@simul` flow |
| `DROP VIEW IF EXISTS` | Cleanup | Only for views matching `sim_*` pattern |
| `INSERT INTO` | New objects or activity log entries | Only during `@proceed` flow |
| `UPDATE` | Capacity adjustments, status changes | Only during `@proceed` flow |

**Explicitly forbidden:** `DELETE`, `TRUNCATE`, `DROP TABLE`, `ALTER TABLE`, `CREATE TABLE`, `GRANT`, `REVOKE`.

### Parameterised Queries Only

All generated SQL uses positional parameters (`$1`, `$2`, ...) passed through the existing `query()` helper:

```typescript
// src/lib/db/client.ts — existing helper
export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
  const sql = neon(process.env.DATABASE_URL!);
  const result = await sql(text, params ?? []);
  return result as T[];
}
```

The Query Planner outputs `{ text: string, params: unknown[] }` tuples — never raw interpolated SQL.

### SQL Validation Layer

Before execution, every generated query passes through a validator:

```typescript
interface ValidatedQuery {
  text: string;
  params: unknown[];
}

function validateQuery(text: string, params: unknown[], context: 'read' | 'simul' | 'proceed'): ValidatedQuery {
  const normalised = text.trim().toUpperCase();

  // Block forbidden statements
  const forbidden = ['DELETE ', 'TRUNCATE ', 'DROP TABLE', 'ALTER TABLE', 'CREATE TABLE', 'GRANT ', 'REVOKE '];
  for (const keyword of forbidden) {
    if (normalised.includes(keyword)) {
      throw new Error(`Forbidden SQL operation: ${keyword.trim()}`);
    }
  }

  // Context-specific checks
  if (context === 'read' && !normalised.startsWith('SELECT')) {
    throw new Error('Read context only allows SELECT');
  }

  if (context === 'simul') {
    const allowed = normalised.startsWith('SELECT') || normalised.startsWith('CREATE VIEW');
    if (!allowed) throw new Error('Simulation context only allows SELECT and CREATE VIEW');
  }

  if (normalised.includes('DROP VIEW') && !normalised.includes('SIM_')) {
    throw new Error('DROP VIEW only allowed for simulation views (sim_* prefix)');
  }

  return { text, params };
}
```

---

## View Management

### Creating Views

```typescript
async function createSimulationViews(
  sessionId: string,
  options: SimulationOption[]
): Promise<string[]> {
  const viewNames: string[] = [];

  for (const option of options) {
    for (const viewDef of option.views) {
      const viewName = `sim_${sessionId}_${option.id}_${viewDef.tableName}`;
      
      // Validate the inner query (must be SELECT-based)
      validateQuery(viewDef.selectQuery, viewDef.params, 'simul');
      
      // CREATE VIEW doesn't support parameterised values inside the definition,
      // so we build the view from a validated SELECT and use a safe name check
      if (!/^[a-z0-9_]+$/.test(viewName)) {
        throw new Error('Invalid view name characters');
      }
      
      await query(`CREATE VIEW ${viewName} AS ${viewDef.selectQuery}`, viewDef.params);
      viewNames.push(viewName);
    }
  }

  return viewNames;
}
```

### Dropping Views

```typescript
async function dropSimulationViews(viewNames: string[]): Promise<void> {
  for (const name of viewNames) {
    // Double-check naming pattern
    if (!name.startsWith('sim_')) {
      throw new Error(`Refusing to drop non-simulation view: ${name}`);
    }
    if (!/^[a-z0-9_]+$/.test(name)) {
      throw new Error('Invalid view name characters');
    }
    await query(`DROP VIEW IF EXISTS ${name}`);
  }
}
```

### TTL Cleanup Query

Runs on a schedule (Vercel cron or Neon scheduled query):

```sql
-- Find and drop expired simulation views
DO $$
DECLARE
  v_name TEXT;
  v_session_id VARCHAR(12);
BEGIN
  -- Find active sessions older than 60 minutes
  FOR v_session_id IN
    SELECT session_id FROM simulation_sessions
    WHERE status = 'active'
      AND created_at < NOW() - INTERVAL '60 minutes'
  LOOP
    -- Drop all views for this session
    FOR v_name IN
      SELECT unnest(view_names) FROM simulation_sessions
      WHERE session_id = v_session_id
    LOOP
      EXECUTE format('DROP VIEW IF EXISTS %I', v_name);
    END LOOP;

    -- Mark session as expired
    UPDATE simulation_sessions
    SET status = 'expired', resolved_at = NOW()
    WHERE session_id = v_session_id;
  END LOOP;
END $$;
```

---

## Transaction Pattern for `@proceed`

```typescript
async function commitOption(sessionId: string, optionId: string): Promise<CommitResult> {
  // 1. Fetch planned mutations
  const mutations = await query<SimulationMutation>(
    `SELECT * FROM simulation_mutations
     WHERE session_id = $1 AND option_id = $2
     ORDER BY sort_order`,
    [sessionId, optionId]
  );

  if (mutations.length === 0) {
    throw new Error('NO_ACTIVE_SIMULATION');
  }

  // 2. Execute in transaction
  // Note: Neon serverless driver supports transaction() for multi-statement atomicity
  const sql = neon(process.env.DATABASE_URL!);
  
  const results = await sql.transaction(async (tx) => {
    const affected: Record<string, number> = {};

    for (const mutation of mutations) {
      const params = mutation.query_params as unknown[];
      const result = await tx(mutation.query_text, params);
      affected[mutation.table_name] = (affected[mutation.table_name] || 0) + result.length;
    }

    // Log to activity_log
    await tx(
      `INSERT INTO activity_log (node_id, event_type, time)
       VALUES ($1, 'SIMULATION_COMMIT', NOW())`,
      [sessionId]
    );

    return affected;
  });

  // 3. Cleanup views
  const session = await query<{ view_names: string[] }>(
    `SELECT view_names FROM simulation_sessions WHERE session_id = $1`,
    [sessionId]
  );
  await dropSimulationViews(session[0].view_names);

  // 4. Update session record
  await query(
    `UPDATE simulation_sessions
     SET status = 'committed', chosen_option = $1, resolved_at = NOW()
     WHERE session_id = $2`,
    [optionId, sessionId]
  );

  // 5. Clean up stored mutations
  await query(
    `DELETE FROM simulation_mutations WHERE session_id = $1`,
    [sessionId]
  );

  return { optionId, affectedRows: results };
}
```

---

## Coordinate Storage Format

The existing `businesses` and `warehouse` tables store coordinates as `DOUBLE PRECISION[]` (Postgres array). The Geo Planner uses these for distance calculations.

```sql
-- Current schema (from create-schema.ts)
coordinates DOUBLE PRECISION[]
-- Stored as: ARRAY[latitude, longitude]
-- Example: ARRAY[31.5204, 74.3587] (Lahore)
```

### Haversine Distance Function (DB-Side)

A reusable SQL function for proximity queries:

```sql
CREATE OR REPLACE FUNCTION haversine_km(
  lat1 DOUBLE PRECISION, lon1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION, lon2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION AS $$
  SELECT 6371 * acos(
    LEAST(1.0,
      cos(radians(lat1)) * cos(radians(lat2))
      * cos(radians(lon2) - radians(lon1))
      + sin(radians(lat1)) * sin(radians(lat2))
    )
  )
$$ LANGUAGE SQL IMMUTABLE;
```

Usage in agent queries:
```sql
SELECT business_id, region,
       haversine_km(coordinates[1], coordinates[2], $1, $2) AS distance_km
FROM businesses
WHERE object_category = $3
ORDER BY distance_km ASC
LIMIT 5;
```
