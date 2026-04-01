# Table: `object`

[← Back to Overview](./README.md)

Represents an **inventory item** stored in a warehouse. There are 240 objects total — 10 per warehouse. Each object tracks its category, quantity, transit state, and health metrics.

---

## DDL

```sql
CREATE TABLE object (
    object_id       VARCHAR(15)  PRIMARY KEY,
    object_category VARCHAR(200) NOT NULL,
    quantity        INT          NOT NULL CHECK (quantity >= 0),
    unit            VARCHAR(30)  NOT NULL,
    arrival_time    TIMESTAMP    NOT NULL,
    transit_status  VARCHAR(20)  NOT NULL CHECK (transit_status IN ('In Transit','—')),
    object_health   VARCHAR(10)  NOT NULL,
    warehouse_id    VARCHAR(10)  NOT NULL REFERENCES warehouse(warehouse_id)
);
```

---

## Columns

| Column | Type | Constraints | Description |
|---|---|---|---|
| `object_id` | `VARCHAR(15)` | **PK** | Format `OBJ-xxxx` — four-digit zero-padded number |
| `object_category` | `VARCHAR(200)` | NOT NULL | Type of material, e.g. `"Sulfuric Acid"`, `"Ethanol"` |
| `quantity` | `INT` | NOT NULL, ≥ 0 | Units in stock. Contributes directly to `warehouse.capacity_used` |
| `unit` | `VARCHAR(30)` | NOT NULL | Unit of measure: `Ltr`, `kg`, `pcs`, `mtr`, `rol`, `spl`, `cnt` |
| `arrival_time` | `TIMESTAMP` | NOT NULL | Scheduled or actual arrival datetime |
| `transit_status` | `VARCHAR(20)` | NOT NULL, CHECK | `'In Transit'` — item is in movement; `'—'` — item is at rest in warehouse |
| `object_health` | `VARCHAR(10)` | NOT NULL | Percentage string with sign, e.g. `"+13.28%"` or `"-6.53%"` |
| `warehouse_id` | `VARCHAR(10)` | **FK** → [`warehouse`](./warehouse.md), NOT NULL | The warehouse this object belongs to |

---

## transit_status Values

| Value | Meaning | Filter Label |
|---|---|---|
| `In Transit` | Object is currently in movement between locations | "In Transit" |
| `—` | Object is stationary / stored in warehouse | "Not in Transit" |

> The `—` character (em-dash, U+2014) is the stored value. The application filter panel displays it as **"Not in Transit"** for readability.

---

## object_health Format

`object_health` is stored as a signed percentage string. The application parses it to determine display color:

```ts
// Positive (green): absolute value ≥ 30%
// Negative (red):   absolute value < 30%
Math.abs(parseFloat(o.objectHealth)) >= 30
```

Examples: `"+13.28%"`, `"-6.53%"`, `"+42.00%"`

---

## Sample Data

| object_id | object_category | quantity | unit | transit_status | object_health | warehouse_id |
|---|---|---|---|---|---|---|
| OBJ-0001 | Sulfuric Acid | 882 | Ltr | — | +13.28% | NMP-100 |
| OBJ-0002 | Acetone | 777 | Ltr | In Transit | -6.53% | NMP-100 |
| OBJ-0003 | Sulfuric Acid | 673 | Ltr | — | +8.95% | NMP-100 |
| OBJ-0004 | Ethanol | 929 | Ltr | In Transit | -4.12% | NMP-100 |
| OBJ-0005 | Ammonia | 500 | Ltr | — | +22.00% | NMP-100 |

---

## Indexes

```sql
CREATE INDEX idx_obj_warehouse ON object (warehouse_id);
CREATE INDEX idx_obj_transit   ON object (transit_status);
```

---

## Capacity Contribution

`warehouse.capacity_used` is the **sum of all object quantities** for that warehouse:

```sql
SELECT warehouse_id, SUM(quantity) AS capacity_used
FROM object
GROUP BY warehouse_id;
```

In the app this is computed in TypeScript:

```ts
// lib/data/objects.ts
export function computeUsedCapacity(warehouseId: string): number {
  return getObjectsByWarehouseId(warehouseId).reduce((sum, o) => sum + o.quantity, 0)
}
```

---

## Relationships

| Direction | Related Table | Via | Cardinality |
|---|---|---|---|
| Many objects → one warehouse | [warehouse](./warehouse.md) | `object.warehouse_id` | N : 1 |
| One object → many timeline entries | [timeline](./timeline.md) | `timeline.object_id` | 1 : N |

---

## Application Layer Mapping

Object data comes from two JSON sources joined at runtime by `objectId`:

- **`objects-data.json`** — raw fields: `objectId`, `quantity`, `unit`, `transitStatus`, `objectHealth`, `arrivalTime`
- **`object-relationships.json`** — join file: `objectId` → `warehouseId`, `objectCategory`

See [app-layer.md](./app-layer.md).
