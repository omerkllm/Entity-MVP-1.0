# Application Data Layer (JSON → SQL Mapping)

[← Back to Overview](./README.md)

The Next.js app does not query a live database — it reads flat **JSON files** at build time. This document maps each JSON file to its SQL counterpart and explains the runtime join logic.

---

## File Inventory

| JSON File | SQL Equivalent | Description |
|---|---|---|
| [`supply-chain-nodes.json`](#supply-chain-nodesjson) | `process` | Pipeline stage nodes |
| [`warehousing-data.json`](#warehousing-datajson) | `warehouse` (enriched) | Raw warehouse records + embedded UI data |
| [`warehouse-relationships.json`](#warehouse-relationshipsjson) | `warehouse` join fields | Adds `objectCategory`, `businessLinkType`, `processId` |
| [`objects-data.json`](#objects-datajson) | `object` | Raw inventory item records |
| [`object-relationships.json`](#object-relationshipsjson) | `object` join fields | Adds `objectCategory`, `warehouseId` |
| [`category-colors.json`](#category-colorsjson) | UI only | Color map for process names (no SQL equivalent) |
| [`activity-log.json`](#activity-logjson) | UI only | Recent disruption events (no SQL equivalent) |
| [`ai-agent-simulations.json`](#ai-agent-simulationsjson) | UI only | Decision-making simulation scripts |

---

## supply-chain-nodes.json

**Maps to:** [`process`](./process.md)

```json
{ "id": "OBJ-127", "name": "Chemicals", "status": "Active", "quantity": 3200, "unit": "kg", "lastUpdated": "2026-03-14" }
```

| JSON field | SQL column | Notes |
|---|---|---|
| `id` | `process.process_id` | Different format: JSON uses `OBJ-1xx`, SQL uses `PRC-0x` |
| `name` | `process.name` | Same values |
| `status` | — | `Active` / `Pending` — used by app only, no SQL column |
| `quantity` | — | Aggregate display value — not stored in SQL |
| `unit` | — | Display unit — not stored in SQL |
| `lastUpdated` | — | Display timestamp — not stored in SQL |

> **Note:** The `id` format differs between layers. JSON uses the `OBJ-1xx` series as process references (`OBJ-127` = Chemicals, `OBJ-128` = Raw Cotton, etc.). The SQL uses `PRC-0x`.

---

## warehousing-data.json

**Maps to:** [`warehouse`](./warehouse.md)

```json
{
  "id": "1642-A",
  "warehouseId": "NMP-100",
  "title": "Boxwlow",
  "usedCapacity": -6.53,
  "totalCapacity": 10000,
  "region": "Multan",
  "status": "Open",
  "coordinates": "30.1575° N, 71.5249° E",
  "hours": "06:00 → 16:00",
  "warehouseName": "Warehouse 1642-A { NMP-100 }",
  "address": "NMP-100 Warehouse, 784 Factory Lane, Los Angeles",
  "objects": [...],
  "chartBars": [...],
  "chartLabels": [...]
}
```

| JSON field | SQL column | Notes |
|---|---|---|
| `warehouseId` | `warehouse.warehouse_id` | App format `NMP-xxx`, SQL uses `WH-X0N` |
| `title` | `warehouse.title` | |
| `region` | `warehouse.region` | |
| `coordinates` | `warehouse.coordinates` | |
| `status` | `warehouse.status` | |
| `totalCapacity` | `warehouse.total_capacity` | |
| `hours` | `warehouse.operational_hours` | |
| `address` | — | Display only |
| `usedCapacity` | `warehouse.capacity_used` | **Overridden at runtime** — app computes from sum of object quantities, ignoring raw JSON value |
| `objects[]` | — | Embedded summary for UI chart/inspector — not a normalized table |
| `chartBars[]` | — | UI-only rendering data |
| `chartLabels[]` | — | UI-only rendering data |

---

## warehouse-relationships.json

**Maps to:** Foreign key enrichment for [`warehouse`](./warehouse.md)

```json
{ "warehouseId": "NMP-100", "objectCategory": "Acetone", "businessLinkType": "Supplier", "processId": "OBJ-127" }
```

| JSON field | SQL column | Notes |
|---|---|---|
| `warehouseId` | `warehouse.warehouse_id` | Join key |
| `objectCategory` | `warehouse.object_category_major` | |
| `businessLinkType` | `warehouse.business_link_type` | Two values: `Supplier` (inbound) or `Customer` (outbound) |
| `processId` | `category.process_id` (via warehouse→category) | App format `OBJ-1xx`, SQL format `PRC-0x` |

**Runtime join (TypeScript):**
```ts
// lib/data/warehouses.ts
const rel = relationshipMap.get(raw.warehouseId)
return { ...raw, objectCategory: rel?.objectCategory, businessLinkType: rel?.businessLinkType, processId: rel?.processId }
```

---

## objects-data.json

**Maps to:** [`object`](./object.md)

```json
{ "objectId": "OBJ-0001", "quantity": 882, "unit": "Ltr", "transitStatus": "—", "objectHealth": "+13.28%", "arrivalTime": "2026-09-05 07:27" }
```

| JSON field | SQL column | Notes |
|---|---|---|
| `objectId` | `object.object_id` | |
| `quantity` | `object.quantity` | |
| `unit` | `object.unit` | |
| `transitStatus` | `object.transit_status` | `"In Transit"` or `"—"` (em-dash U+2014) |
| `objectHealth` | `object.object_health` | Signed percentage string, e.g. `"+13.28%"` |
| `arrivalTime` | `timeline.arrival_time` | Maps to timeline, not stored on `object` in SQL |

---

## object-relationships.json

**Maps to:** Foreign key enrichment for [`object`](./object.md)

```json
{ "objectId": "OBJ-0001", "warehouseId": "NMP-100", "objectCategory": "Sulfuric Acid" }
```

| JSON field | SQL column | Notes |
|---|---|---|
| `objectId` | `object.object_id` | Join key |
| `warehouseId` | `object.warehouse_id` | |
| `objectCategory` | `object.object_category` | |

**Runtime join (TypeScript):**
```ts
// lib/data/objects.ts
const rel = relationshipMap.get(raw.objectId)
return { ...raw, objectCategory: rel?.objectCategory, warehouseId: rel?.warehouseId }
```

---

## category-colors.json

**Maps to:** No SQL equivalent — UI only

```json
{ "Chemicals": "#2969FF", "Raw Cotton": "#63b174", "Spinning": "#4fd768", ... }
```

A flat map of process name → hex color used by the supply chain dashboard and filter panel. This is purely presentational data with no database counterpart.

---

## activity-log.json

**Maps to:** No SQL equivalent — UI only

```json
{ "nodeId": "OBJ-130", "eventType": "Supply Chain Node Disrupted", "time": "Now" }
```

Recent disruption events shown in the dashboard sidebar. `nodeId` references a `supply-chain-nodes.json` entry. No dedicated SQL table — in production this would be an `events` or `audit_log` table.

---

## ai-agent-simulations.json

**Maps to:** No SQL equivalent — application logic only

Pre-scripted AI agent conversation trees for the Decision Making page. Contains simulation scenarios with branching options (Optimal / Fast & High Risk / Alternative). No SQL table — in production this would live in an agent session store or similar.

---

## Runtime Join Architecture

```
objects-data.json ──────────────┐
                                 ├─ JOIN on objectId ──▶ ObjectRecord (full)
object-relationships.json ───────┘

warehousing-data.json ──────────┐
                                 ├─ JOIN on warehouseId ──▶ Warehouse (full)
warehouse-relationships.json ───┘

supply-chain-nodes.json ─────────▶ SupplyChainNode (no join needed)
```

All joins happen in `src/lib/data/` at module load time — results are cached as module-level constants (`allObjects`, `allWarehouses`, `supplyChainNodes`).
