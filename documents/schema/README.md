# Database Schema — Overview

This folder documents the complete database schema for the Entity Supply Chain Management system. The database is **PostgreSQL** and models a textile supply chain from raw chemicals through to export.

---

## Entity Relationship Diagram

```
┌─────────────┐        ┌──────────────┐        ┌──────────────┐
│   process   │──1:N──▶│   category   │──1:N──▶│  warehouse   │
│  (PRC-xx)   │        │  (CAT-xxx)   │        │  (WH-xxx /   │
│             │◀──self─│              │        │   NMP-xxx)   │
└─────────────┘        └──────────────┘        └──────┬───────┘
                                                       │ 1
                                               M:1     │
                                          ┌────────────┘
                                          │
                                    ┌─────▼──────┐        ┌──────────────┐
                                    │   object   │──1:N──▶│   timeline   │
                                    │ (OBJ-xxxx) │        │  (TL-xxxxx)  │
                                    └────────────┘        └──────────────┘
                                          ▲
                                          │ M:1 (nullable)
                                   ┌──────┴──────┐
                                   │  business   │
                                   │  (BIZ-xxx)  │
                                   └─────────────┘
```

> `process` has a self-referencing FK (`next_process_id`) forming a linear pipeline chain.  
> `warehouse.business_id` is **nullable** — internal warehouses have no business partner.  
> `warehouse.timeline_id` is a circular FK resolved with `ALTER TABLE` after `timeline` is created.

---

## Tables

| Table | Rows | Description | File |
|---|---|---|---|
| [process](./process.md) | 8 | Supply chain stage nodes | [process.md](./process.md) |
| [category](./category.md) | 24 | Prominence tiers per process (3 per process) | [category.md](./category.md) |
| [business](./business.md) | 24 | External supplier / buyer partners | [business.md](./business.md) |
| [warehouse](./warehouse.md) | 24 | Physical warehouses (3 per process) | [warehouse.md](./warehouse.md) |
| [object](./object.md) | 240 | Inventory items stored in warehouses (10 per warehouse) | [object.md](./object.md) |
| [timeline](./timeline.md) | 240 | Arrival tracking entries per object | [timeline.md](./timeline.md) |

**Total rows: 560**

---

## Relationships

See [relations.md](./relations.md) for the full foreign key map, cardinalities, and join patterns.

---

## Application Layer (JSON)

The Next.js application uses flat JSON files as the data source. See [app-layer.md](./app-layer.md) for how each JSON file maps to the SQL tables above.

---

## Supply Chain Pipeline

The `process` table forms a directed linear chain:

```
PRC-01 Chemicals
  └─▶ PRC-02 Raw Cotton
        └─▶ PRC-03 Spinning
              └─▶ PRC-04 Knitting ──┐
              └─▶ PRC-05 Weaving  ──┤
                                    └─▶ PRC-06 Dyeing
                                              └─▶ PRC-07 Garment Assembly
                                                          └─▶ PRC-08 Export (terminal)
```

Each process node has **3 warehouses** (Prominent / Supplementary / Complementary category) and each warehouse contains **10 objects** (inventory items).
