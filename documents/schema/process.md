# Table: `process`

[← Back to Overview](./README.md)

Represents a **stage in the supply chain pipeline**. Each process is one step in textile manufacturing — from raw chemicals through to finished export. The table is self-referencing: each row points to the next step in the chain.

---

## DDL

```sql
CREATE TABLE process (
    process_id       VARCHAR(10)  PRIMARY KEY,
    name             VARCHAR(100) NOT NULL,
    next_process_id  VARCHAR(10)  REFERENCES process(process_id)
);
```

---

## Columns

| Column | Type | Constraints | Description |
|---|---|---|---|
| `process_id` | `VARCHAR(10)` | **PK** | Identifier — format `PRC-0x` |
| `name` | `VARCHAR(100)` | NOT NULL | Human-readable stage name |
| `next_process_id` | `VARCHAR(10)` | FK → `process.process_id`, nullable | Points to the next process in the chain. `NULL` for the terminal node (Export) |

---

## Seed Data (8 rows)

| process_id | name | next_process_id |
|---|---|---|
| PRC-01 | Chemicals | PRC-02 |
| PRC-02 | Raw Cotton | PRC-03 |
| PRC-03 | Spinning | PRC-04 |
| PRC-04 | Knitting | PRC-06 |
| PRC-05 | Weaving | PRC-06 |
| PRC-06 | Dyeing | PRC-07 |
| PRC-07 | Garment Assembly | PRC-08 |
| PRC-08 | Export | NULL |

> PRC-04 (Knitting) and PRC-05 (Weaving) both feed into PRC-06 (Dyeing), forming a **fork** in the pipeline.

---

## Indexes

```sql
-- Self-referencing FK traversal
CREATE INDEX idx_processes_next ON process (next_process_id);
```

---

## Relationships

| Direction | Related Table | Via | Cardinality |
|---|---|---|---|
| One process → many categories | [category](./category.md) | `category.process_id` | 1 : N (3 per process) |
| Self-reference (next step) | process | `next_process_id` | 1 : 0-1 |

---

## Application Layer Mapping

In the app, `process` rows correspond directly to entries in [`supply-chain-nodes.json`](./app-layer.md#supply-chain-nodesjson). The `id` field in the JSON matches `process_id`. The supply chain dashboard uses these as clickable nodes that filter the warehouse table.

See [app-layer.md](./app-layer.md) for full mapping details.
