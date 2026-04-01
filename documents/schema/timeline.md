# Table: `timeline`

[← Back to Overview](./README.md)

Tracks **arrival events** for inventory objects — recording when a batch arrived and how many units were delivered at that point in time. There are 240 timeline entries, one per object.

---

## DDL

```sql
CREATE TABLE timeline (
    timeline_id  VARCHAR(20)  PRIMARY KEY,
    object_id    VARCHAR(15)  NOT NULL REFERENCES object(object_id),
    arrival_time TIMESTAMP    NOT NULL,
    quantity     INT          NOT NULL CHECK (quantity >= 0)
);

-- Resolves circular FK: warehouse references back to the current timeline entry
ALTER TABLE warehouse
    ADD CONSTRAINT fk_warehouse_timeline_id
    FOREIGN KEY (timeline_id) REFERENCES timeline(timeline_id);
```

---

## Columns

| Column | Type | Constraints | Description |
|---|---|---|---|
| `timeline_id` | `VARCHAR(20)` | **PK** | Format `TL-xxxxx` |
| `object_id` | `VARCHAR(15)` | **FK** → [`object`](./object.md), NOT NULL | The object this event belongs to |
| `arrival_time` | `TIMESTAMP` | NOT NULL | When this batch arrived |
| `quantity` | `INT` | NOT NULL, ≥ 0 | How many units arrived in this delivery |

---

## Circular FK Explanation

There is a **circular reference** between `warehouse` and `timeline`:

```
warehouse.timeline_id  →  timeline.timeline_id
timeline.object_id     →  object.object_id
object.warehouse_id    →  warehouse.warehouse_id
```

This forms a triangle, not a simple chain. The resolution strategy used in the DDL:

1. Create `warehouse` first, with `timeline_id` column but **no FK constraint yet**
2. Create `timeline` (which references `object`, which references `warehouse`)
3. `ALTER TABLE warehouse ADD CONSTRAINT` to add the FK after `timeline` exists

This is a standard PostgreSQL deferred-constraint pattern.

---

## Indexes

```sql
CREATE INDEX idx_tl_object  ON timeline (object_id);
CREATE INDEX idx_tl_arrival ON timeline (arrival_time DESC);
```

---

## Relationships

| Direction | Related Table | Via | Cardinality |
|---|---|---|---|
| Many timeline entries → one object | [object](./object.md) | `timeline.object_id` | N : 1 |
| One timeline entry ← one warehouse | [warehouse](./warehouse.md) | `warehouse.timeline_id` | 1 : 0-1 (warehouse points to its current/latest entry) |

---

## Application Layer Mapping

There is no direct `timeline` JSON file in the application. The `arrivalTime` field on each object in `objects-data.json` represents the most recent arrival timestamp — equivalent to the latest `timeline.arrival_time` for that object. The full historical timeline ledger exists only in the SQL database.

See [app-layer.md](./app-layer.md).
