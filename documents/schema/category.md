# Table: `category`

[← Back to Overview](./README.md)

Classifies each warehouse by its **prominence tier** within a process. There are exactly 3 categories per process: Prominent, Supplementary, and Complementary — giving 24 total rows.

---

## DDL

```sql
CREATE TABLE category (
    category_id  VARCHAR(10)  PRIMARY KEY,
    name         VARCHAR(150) NOT NULL,
    process_id   VARCHAR(10)  NOT NULL REFERENCES process(process_id)
);
```

---

## Columns

| Column | Type | Constraints | Description |
|---|---|---|---|
| `category_id` | `VARCHAR(10)` | **PK** | Format `CAT-0PT` where P = process number, T = tier (1/2/3) |
| `name` | `VARCHAR(150)` | NOT NULL | Full name, e.g. `"Prominent Chemicals"` |
| `process_id` | `VARCHAR(10)` | **FK** → [`process`](./process.md), NOT NULL | The process this category belongs to |

---

## Seed Data (24 rows — 3 per process)

| category_id | name | process_id |
|---|---|---|
| CAT-011 | Prominent Chemicals | PRC-01 |
| CAT-012 | Supplementary Chemicals | PRC-01 |
| CAT-013 | Complementary Chemicals | PRC-01 |
| CAT-021 | Prominent Raw Cotton | PRC-02 |
| CAT-022 | Supplementary Raw Cotton | PRC-02 |
| CAT-023 | Complementary Raw Cotton | PRC-02 |
| CAT-031 | Prominent Spinning | PRC-03 |
| CAT-032 | Supplementary Spinning | PRC-03 |
| CAT-033 | Complementary Spinning | PRC-03 |
| CAT-041 | Prominent Knitting | PRC-04 |
| CAT-042 | Supplementary Knitting | PRC-04 |
| CAT-043 | Complementary Knitting | PRC-04 |
| CAT-051 | Prominent Weaving | PRC-05 |
| CAT-052 | Supplementary Weaving | PRC-05 |
| CAT-053 | Complementary Weaving | PRC-05 |
| CAT-061 | Prominent Dyeing | PRC-06 |
| CAT-062 | Supplementary Dyeing | PRC-06 |
| CAT-063 | Complementary Dyeing | PRC-06 |
| CAT-071 | Prominent Garment Assembly | PRC-07 |
| CAT-072 | Supplementary Garment Assembly | PRC-07 |
| CAT-073 | Complementary Garment Assembly | PRC-07 |
| CAT-081 | Prominent Export | PRC-08 |
| CAT-082 | Supplementary Export | PRC-08 |
| CAT-083 | Complementary Export | PRC-08 |

---

## Indexes

```sql
CREATE INDEX idx_category_process ON category (process_id);
```

---

## Relationships

| Direction | Related Table | Via | Cardinality |
|---|---|---|---|
| Many categories → one process | [process](./process.md) | `category.process_id` | N : 1 |
| One category → many warehouses | [warehouse](./warehouse.md) | `warehouse.category_id` | 1 : N (1 per category in current data) |

---

## Application Layer Mapping

The `businessLinkType` column in [`warehouse-relationships.json`](./app-layer.md#warehouse-relationshipsjson) (values: `Supplier`, `Customer`) is the application-level equivalent of the category prominence tier. The SQL schema uses `CAT-xxx` IDs for this classification.

See [app-layer.md](./app-layer.md) for full mapping details.
