# Database Relations

[← Back to Overview](./README.md)

Full map of every foreign key, cardinality, join pattern, and the circular FK resolution in this schema.

---

## Foreign Key Map

```
processes.next_process_id  ──self──▶  processes.process_id
category.process_id        ──────────▶ processes.process_id
warehouse.category_id      ──────────▶ category.category_id
warehouse.business_id      ──────────▶ business.business_id   (nullable)
warehouse.timeline_id      ──────────▶ timeline.timeline_id   (nullable, circular)
object.warehouse_id        ──────────▶ warehouse.warehouse_id
timeline.object_id         ──────────▶ object.object_id
```

---

## All Relationships at a Glance

| From | Column | To | Type | Notes |
|---|---|---|---|---|
| [process](./process.md) | `next_process_id` | [process](./process.md) | Self-ref 1:0-1 | NULL on terminal node (Export) |
| [category](./category.md) | `process_id` | [process](./process.md) | N:1 | 3 categories per process |
| [warehouse](./warehouse.md) | `category_id` | [category](./category.md) | N:1 | 1 warehouse per category in current data |
| [warehouse](./warehouse.md) | `business_id` | [business](./business.md) | N:1 nullable | NULL for internal processes |
| [warehouse](./warehouse.md) | `timeline_id` | [timeline](./timeline.md) | 1:0-1 nullable | Circular FK — points to latest timeline entry |
| [object](./object.md) | `warehouse_id` | [warehouse](./warehouse.md) | N:1 | 10 objects per warehouse |
| [timeline](./timeline.md) | `object_id` | [object](./object.md) | N:1 | 1 timeline entry per object in current data |

---

## Cardinalities

```
process (8)
    │ 1
    │ N
category (24)  ──── 3 per process
    │ 1
    │ N
warehouse (24) ──── 1 per category, 3 per process
    │ 1              │ N                    │ 1
    │ N              ▼                      ▼
object (240)   business (24)         timeline (240)
10 per wh.      1 per warehouse       1 per object
```

---

## Join Patterns

### Get all objects for a process

```sql
SELECT o.*
FROM object o
JOIN warehouse w ON o.warehouse_id = w.warehouse_id
JOIN category  c ON w.category_id  = c.category_id
WHERE c.process_id = 'PRC-01';
```

### Get warehouse capacity summary

```sql
SELECT
    w.warehouse_id,
    w.title,
    w.total_capacity,
    SUM(o.quantity)                                         AS capacity_used,
    ROUND(SUM(o.quantity)::DECIMAL / w.total_capacity, 4)  AS capacity_pct
FROM warehouse w
LEFT JOIN object o ON o.warehouse_id = w.warehouse_id
GROUP BY w.warehouse_id, w.title, w.total_capacity;
```

### Get full supply chain pipeline in order

```sql
WITH RECURSIVE chain AS (
    SELECT process_id, name, next_process_id, 1 AS step
    FROM process WHERE process_id = 'PRC-01'
    UNION ALL
    SELECT p.process_id, p.name, p.next_process_id, c.step + 1
    FROM process p
    JOIN chain c ON p.process_id = c.next_process_id
)
SELECT step, process_id, name FROM chain ORDER BY step;
```

### Get warehouses with their business partner

```sql
SELECT
    w.warehouse_id,
    w.title,
    w.region,
    b.business_id,
    b.object_category_major,
    w.business_link_type
FROM warehouse w
LEFT JOIN business b ON w.business_id = b.business_id;
```

---

## Circular FK — Warehouse ↔ Timeline

The triangle relationship:

```
warehouse ──timeline_id──▶ timeline
    ▲                          │
    │                     object_id
    │                          ▼
    └──────warehouse_id── object
```

**Why it exists:** A warehouse needs a direct pointer to its most recent timeline snapshot for fast reads. The resolution:

1. `warehouse` table is created first **without** the `timeline_id` FK
2. `object` is created referencing `warehouse`
3. `timeline` is created referencing `object`
4. `ALTER TABLE warehouse ADD CONSTRAINT` adds the FK to `timeline` last

This avoids a chicken-and-egg problem at DDL time while preserving referential integrity at runtime.

---

## Cascade Behavior

Current schema uses default `NO ACTION` on all FKs — no cascading deletes or updates. Drop order for safe teardown:

```sql
DROP TABLE IF EXISTS timeline   CASCADE;
DROP TABLE IF EXISTS object     CASCADE;
DROP TABLE IF EXISTS warehouse  CASCADE;
DROP TABLE IF EXISTS category   CASCADE;
DROP TABLE IF EXISTS process    CASCADE;
DROP TABLE IF EXISTS business   CASCADE;
```

---

## All Indexes

```sql
-- process
CREATE INDEX idx_processes_next   ON process   (next_process_id);

-- category
CREATE INDEX idx_category_process ON category  (process_id);

-- warehouse
CREATE INDEX idx_wh_business      ON warehouse (business_id);
CREATE INDEX idx_wh_category      ON warehouse (category_id);
CREATE INDEX idx_wh_status        ON warehouse (status);
CREATE INDEX idx_wh_timeline      ON warehouse (timeline_id);

-- object
CREATE INDEX idx_obj_warehouse    ON object    (warehouse_id);
CREATE INDEX idx_obj_transit      ON object    (transit_status);

-- timeline
CREATE INDEX idx_tl_object        ON timeline  (object_id);
CREATE INDEX idx_tl_arrival       ON timeline  (arrival_time DESC);
```
