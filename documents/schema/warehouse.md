# Table: `warehouse`

[← Back to Overview](./README.md)

Represents a **physical warehouse facility** in the supply chain. There are 24 warehouses — 3 per process node. Each warehouse belongs to one category tier and optionally links to an external business partner.

---

## DDL

```sql
CREATE TABLE warehouse (
    warehouse_id           VARCHAR(10)  PRIMARY KEY,
    title                  VARCHAR(100) NOT NULL,
    region                 VARCHAR(100) NOT NULL,
    coordinates            VARCHAR(50)  NOT NULL,
    object_category_major  VARCHAR(150),
    operational_hours      VARCHAR(20),
    status                 VARCHAR(10)  NOT NULL CHECK (status IN ('Open', 'Closed')),
    total_capacity         INTEGER      NOT NULL CHECK (total_capacity > 0),
    capacity_used          INTEGER      NOT NULL DEFAULT 0 CHECK (capacity_used >= 0),
    capacity_pct           DECIMAL(5,4) GENERATED ALWAYS AS (
                               CASE WHEN total_capacity > 0
                                    THEN CAST(capacity_used AS DECIMAL) / total_capacity
                                    ELSE 0 END
                           ) STORED,
    category_id            VARCHAR(10)  REFERENCES category(category_id),
    business_id            VARCHAR(10)  REFERENCES business(business_id),
    -- Circular FK resolved with ALTER TABLE after timeline is created:
    timeline_id            VARCHAR(20)  DEFAULT NULL
);

ALTER TABLE warehouse
    ADD CONSTRAINT fk_warehouse_timeline_id
    FOREIGN KEY (timeline_id) REFERENCES timeline(timeline_id);
```

---

## Columns

| Column | Type | Constraints | Description |
|---|---|---|---|
| `warehouse_id` | `VARCHAR(10)` | **PK** | Format `WH-X0N` (SQL) or `NMP-1xx` (app JSON) |
| `title` | `VARCHAR(100)` | NOT NULL | Warehouse brand name, e.g. `"Boxwlow"` |
| `region` | `VARCHAR(100)` | NOT NULL | City name |
| `coordinates` | `VARCHAR(50)` | NOT NULL | `{lat}N {lng}E` format |
| `object_category_major` | `VARCHAR(150)` | nullable | Primary object category stored here |
| `operational_hours` | `VARCHAR(20)` | nullable | Operating window, e.g. `"07:00-19:00"` |
| `status` | `VARCHAR(10)` | NOT NULL, CHECK `Open`/`Closed` | Current operational status |
| `total_capacity` | `INTEGER` | NOT NULL, > 0 | Maximum stock capacity in units |
| `capacity_used` | `INTEGER` | NOT NULL, ≥ 0, default 0 | Units currently occupied (sum of object quantities) |
| `capacity_pct` | `DECIMAL(5,4)` | GENERATED STORED | `capacity_used / total_capacity` — computed automatically |
| `category_id` | `VARCHAR(10)` | **FK** → [`category`](./category.md) | Prominence tier for this warehouse |
| `business_id` | `VARCHAR(10)` | **FK** → [`business`](./business.md), nullable | Linked external partner. NULL for internal manufacturing steps |
| `timeline_id` | `VARCHAR(20)` | **FK** → [`timeline`](./timeline.md), nullable | Most recent timeline entry (circular FK added via ALTER) |

---

## Seed Data (24 rows — 3 per process)

| warehouse_id | title | region | status | total_capacity | capacity_used | category_id | business_id |
|---|---|---|---|---|---|---|---|
| WH-C01 | Nexchem Storage | Karachi | Open | 150 | 112 | CAT-011 | BIZ-C01 |
| WH-C02 | Aldex Depot | Lahore | Open | 120 | 54 | CAT-012 | BIZ-C02 |
| WH-C03 | Chemstore Hub | Faisalabad | Closed | 100 | 88 | CAT-013 | BIZ-C03 |
| WH-R01 | Marklex | Karachi | Open | 100 | 72 | CAT-021 | BIZ-R01 |
| WH-R02 | Boxwlow | Lahore | Closed | 130 | 48 | CAT-022 | BIZ-R02 |
| WH-R03 | Cottonfield Store | Multan | Open | 160 | 140 | CAT-023 | BIZ-R03 |
| WH-S01 | Spinex Yard | Faisalabad | Open | 200 | 155 | CAT-031 | BIZ-S01 |
| WH-S02 | Yarnvault | Karachi | Open | 180 | 162 | CAT-032 | BIZ-S02 |
| WH-S03 | Threadbase | Lahore | Closed | 140 | 60 | CAT-033 | BIZ-S03 |
| WH-K01 | Knitstore Alpha | Karachi | Open | 120 | 95 | CAT-041 | BIZ-K01 |
| WH-K02 | Loopex Depot | Lahore | Open | 110 | 44 | CAT-042 | BIZ-K02 |
| WH-K03 | Knitvault | Sialkot | Closed | 100 | 78 | CAT-043 | BIZ-K03 |
| WH-W01 | Weavex Central | Faisalabad | Open | 180 | 134 | CAT-051 | BIZ-W01 |
| WH-W02 | Loomstore | Lahore | Open | 160 | 148 | CAT-052 | BIZ-W02 |
| WH-W03 | Fabricbase | Multan | Closed | 140 | 52 | CAT-053 | BIZ-W03 |
| WH-D01 | Dyecore Depot | Karachi | Open | 200 | 176 | CAT-061 | BIZ-D01 |
| WH-D02 | Colorvault | Faisalabad | Open | 170 | 125 | CAT-062 | BIZ-D02 |
| WH-D03 | Chromex Store | Lahore | Closed | 150 | 60 | CAT-063 | BIZ-D03 |
| WH-G01 | Garmex Hub | Karachi | Open | 160 | 131 | CAT-071 | BIZ-G01 |
| WH-G02 | Seam Depot | Lahore | Open | 140 | 118 | CAT-072 | BIZ-G02 |
| WH-G03 | Finishvault | Sialkot | Closed | 120 | 55 | CAT-073 | BIZ-G03 |
| WH-E01 | Export Bay Alpha | Karachi | Open | 250 | 210 | CAT-081 | BIZ-E01 |
| WH-E02 | Portside Store | Lahore | Open | 220 | 196 | CAT-082 | BIZ-E02 |
| WH-E03 | Holdex Terminal | Sialkot | Closed | 180 | 70 | CAT-083 | BIZ-E03 |

---

## Indexes

```sql
CREATE INDEX idx_wh_business  ON warehouse (business_id);
CREATE INDEX idx_wh_category  ON warehouse (category_id);
CREATE INDEX idx_wh_status    ON warehouse (status);
CREATE INDEX idx_wh_timeline  ON warehouse (timeline_id);
```

---

## Computed Column Note

`capacity_pct` is a **generated stored column** — it is automatically recalculated by the database whenever `capacity_used` or `total_capacity` changes. The application layer recomputes this in TypeScript as:

```ts
// lib/data/warehouses.ts
computeCapacityPercent(used, total) = parseFloat(((used / total) * 100).toFixed(2))
```

---

## Relationships

| Direction | Related Table | Via | Cardinality |
|---|---|---|---|
| Many warehouses → one category | [category](./category.md) | `warehouse.category_id` | N : 1 |
| Many warehouses → one business | [business](./business.md) | `warehouse.business_id` | N : 1 (nullable) |
| One warehouse → many objects | [object](./object.md) | `object.warehouse_id` | 1 : N (10 per warehouse) |
| One warehouse → one timeline entry | [timeline](./timeline.md) | `warehouse.timeline_id` | 1 : 0-1 |

---

## Application Layer Mapping

In the app, warehouse data comes from two JSON sources that are joined at runtime:

- **`warehousing-data.json`** — raw warehouse fields (`warehouseId`, `title`, `region`, `status`, `totalCapacity`, `coordinates`, `hours`, `address`, objects list, chartBars)
- **`warehouse-relationships.json`** — join file (`warehouseId` → `objectCategory`, `businessLinkType`, `processId`)

The app uses `NMP-xxx` ID format instead of `WH-xxx`. See [app-layer.md](./app-layer.md).
