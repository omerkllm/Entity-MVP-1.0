# Simulation Engine

## Purpose

The Simulation Engine is the core differentiator of the Parser Agent. It allows users to preview the consequences of supply-chain decisions **before** committing them, using Postgres views as lightweight, disposable "what-if" branches.

---

## Core Concept: Views as Simulation Branches

Instead of cloning tables or using a staging database, each simulation option is represented by one or more **SQL views** that layer hypothetical changes on top of real data.

```
Real table:  warehouse  (source of truth)
     │
     ├── VIEW  sim_abc_opt_a_warehouse  →  shows state after Option A
     ├── VIEW  sim_abc_opt_b_warehouse  →  shows state after Option B
     └── VIEW  sim_abc_opt_c_warehouse  →  shows state after Option C
```

**Why views?**
- Zero data duplication — views reference underlying tables.
- Instant cleanup — `DROP VIEW` is near-free.
- Neon Postgres supports them fully over the serverless HTTP driver.
- Multiple views can be queried in parallel to build option summaries.

---

## Option Generation Strategy

Every `@simul` produces 2–3 options from these archetypes:

### Option A — Optimal (Green)
- Prioritises **reliability** and **proximity**.
- Selects established suppliers with best track records.
- Prefers warehouses with spare capacity closest to the target.
- Typically higher cost or longer lead time, but lowest risk.

### Option B — Moderate (Yellow)
- Balances cost vs. reliability.
- May mix local and remote suppliers.
- Acceptable risk with reasonable trade-offs.

### Option C — Risky (Red)
- Prioritises **speed** or **lowest cost**.
- May involve unvetted suppliers, distant warehouses, or tight timelines.
- Highest potential payoff but also highest failure probability.

Not all simulations produce 3 options. If the scenario is constrained (e.g., only 1 supplier exists), the engine may return 2 or even 1 option with appropriate explanation.

---

## Simulation Lifecycle

```
┌──────────┐   @simul   ┌─────────────┐  ┌───────────────────┐
│  IDLE    │──────────►│  PLANNING    │──►│  VIEWS_CREATED    │
└──────────┘            └─────────────┘  └────────┬──────────┘
                                                   │
                                    ┌──────────────┼──────────────┐
                                    ▼              ▼              ▼
                              ┌──────────┐  ┌──────────┐  ┌──────────┐
                              │ Option A  │  │ Option B  │  │ Option C  │
                              └────┬─────┘  └────┬─────┘  └────┬─────┘
                                   │              │              │
                                   └──────┬───────┘              │
                              @proceed    │         @cancel      │
                                   ▼      │              ▼       │
                              ┌──────────┐│         ┌──────────┐ │
                              │ COMMITTED ││         │ CANCELLED│ │
                              └──────────┘│         └──────────┘ │
                                          │                      │
                                          └───── (60 min TTL) ──►│
                                                   ┌──────────┐  │
                                                   │  EXPIRED  │◄┘
                                                   └──────────┘
```

### States

| State | Description |
|---|---|
| `IDLE` | No active simulation for this session |
| `PLANNING` | NLU + Query Planner are working; views not yet created |
| `VIEWS_CREATED` | Views exist and option cards have been sent to the user |
| `COMMITTED` | User chose an option; mutations applied; views dropped |
| `CANCELLED` | User sent `@cancel`; views dropped; no mutations |
| `EXPIRED` | TTL reached (60 min); views auto-dropped by cleanup |

---

## View Naming Convention

```
sim_{sessionId}_{optionId}_{tableName}
```

**Examples:**
```sql
sim_f3a2bc_opt_a_warehouse
sim_f3a2bc_opt_a_object
sim_f3a2bc_opt_b_warehouse
sim_f3a2bc_opt_b_object
sim_f3a2bc_opt_c_warehouse
```

**Rules:**
- `sessionId` is the first 6 chars of the conversation session UUID.
- `optionId` is always `opt_a`, `opt_b`, or `opt_c`.
- `tableName` matches the real table being simulated (`warehouse`, `object`, `businesses`, `processes`).
- View names are lowercase, underscore-delimited.

---

## View Creation Patterns

### Pattern 1: Capacity Adjustment (Warehouse)

Simulating a warehouse receiving new stock:

```sql
CREATE VIEW sim_f3a2bc_opt_a_warehouse AS
SELECT
  warehouse_id,
  title,
  region,
  coordinates,
  object_category,
  status,
  total_capacity,
  capacity_used + $1 AS capacity_used,  -- projected increase
  business_link_type,
  category_id,
  business_id
FROM warehouse
WHERE warehouse_id = $2

UNION ALL

SELECT * FROM warehouse
WHERE warehouse_id != $2;
```

### Pattern 2: New Object Arrival

Simulating new inventory arriving at a warehouse:

```sql
CREATE VIEW sim_f3a2bc_opt_a_object AS
SELECT * FROM object

UNION ALL

SELECT
  $1 AS object_id,          -- generated ID
  $2 AS object_category,
  $3 AS quantity,
  $4 AS unit,
  NOW() + INTERVAL '2 days' AS arrival_time,
  'In Transit' AS transit_status,
  'Healthy' AS object_health,
  $5 AS warehouse_id;
```

### Pattern 3: Supplier Selection (Read-Only)

Showing which businesses match criteria — no mutation, just a filtered view:

```sql
CREATE VIEW sim_f3a2bc_opt_a_suppliers AS
SELECT
  b.business_id,
  b.object_category,
  b.region,
  b.coordinates,
  -- Haversine-approximate distance in km
  (
    6371 * acos(
      cos(radians($1)) * cos(radians(b.coordinates[1]))
      * cos(radians(b.coordinates[2]) - radians($2))
      + sin(radians($1)) * sin(radians(b.coordinates[1]))
    )
  ) AS distance_km
FROM businesses b
WHERE b.object_category = $3
ORDER BY distance_km ASC
LIMIT 5;
```

---

## Option Scoring

Each option gets a simple risk/benefit score to help the user decide:

```typescript
interface OptionScore {
  costEstimate: 'low' | 'medium' | 'high';
  timeEstimate: string;         // e.g., "2-3 days"
  reliabilityScore: number;     // 0-100
  riskFactors: string[];        // e.g., ["unvetted supplier", "long transit"]
}
```

Scoring factors:
- **Supplier reliability** — based on `activity_log` history (how many successful deliveries?)
- **Geographic distance** — Haversine distance between warehouse and supplier coordinates
- **Capacity fit** — does the target warehouse have room?
- **Timeline feasibility** — can the goods arrive within the user's time constraint?

---

## Preview Data Generation

After views are created, the engine queries each to build a preview object:

```typescript
interface SimulationPreview {
  optionId: string;
  affectedWarehouses: {
    warehouseId: string;
    title: string;
    currentCapacity: number;
    projectedCapacity: number;
  }[];
  newObjects: {
    objectCategory: string;
    quantity: number;
    estimatedArrival: string;
  }[];
  supplierMatches: {
    businessId: string;
    region: string;
    distanceKm: number;
  }[];
}
```

This data populates the option cards in the frontend alongside the `AgentOption.points[]` array.

---

## Cleanup Strategy

### Automatic Cleanup (TTL)
- A scheduled Neon query runs every 15 minutes.
- It queries `pg_catalog.pg_views` for views matching `sim_%` and checks their creation timestamp.
- Views older than 60 minutes are dropped.

```sql
-- List simulation views for cleanup consideration
SELECT viewname
FROM pg_catalog.pg_views
WHERE schemaname = 'public'
  AND viewname LIKE 'sim_%';
```

### Manual Cleanup
- `@cancel` drops all views for the session immediately.
- `@proceed` drops all views after successful commit.
- New `@simul` in the same session drops previous simulation's views first.

### Safety Net
- On session expiry (JWT refresh failure / logout), the API calls cleanup for that session's views.
- The cleanup function is idempotent — `DROP VIEW IF EXISTS` prevents errors on double-drop.

---

## Concurrency

- Each user session gets its own `sessionId` prefix, so views never collide.
- Multiple users can run independent simulations concurrently.
- No table-level locks are taken during view creation — only during `@proceed` commit.
- The Neon serverless driver handles connection pooling transparently.
