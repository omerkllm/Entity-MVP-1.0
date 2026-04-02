# NLU & Context Resolution

## Overview

The NLU (Natural Language Understanding) module converts free-text user messages into structured intent objects that the Query Planner can translate into SQL. It must handle supply-chain domain language, geographic references, and conversational context.

---

## Intent Classification

### Supported Intents

| Intent | Trigger Phrases | Example |
|---|---|---|
| `QUERY_WAREHOUSE` | "warehouse capacity", "how full is", "status of warehouse" | "What's the capacity of the Lahore warehouse?" |
| `QUERY_INVENTORY` | "how much", "stock of", "objects in" | "How much Raw Cotton is in WH-0005?" |
| `QUERY_SUPPLIERS` | "businesses that supply", "who supplies", "suppliers for" | "Which businesses supply Raw Cotton near Punjab?" |
| `QUERY_PROCESSES` | "process status", "what's happening with" | "What's the status of the cotton procurement process?" |
| `SIMULATE_PROCUREMENT` | "I need X units", "source from", "procure" + `@simul` | "I need 30 units of cotton in 4 days @simul" |
| `SIMULATE_ROUTING` | "route", "ship from A to B", "transfer" + `@simul` | "Route 50 units of silk from Karachi to Lahore @simul" |
| `SIMULATE_REBALANCE` | "redistribute", "rebalance", "move stock between" + `@simul` | "Rebalance cotton across Punjab warehouses @simul" |
| `COMPARE_OPTIONS` | "compare", "difference between", "which is better" | "Compare the cost of option A vs option B" |

### Classification Approach

**Option A — Rule-Based (Phase 1):**
Pattern matching with keyword extraction. Fast, predictable, no external API dependency.

```typescript
interface Intent {
  type: string;                  // e.g., 'SIMULATE_PROCUREMENT'
  confidence: number;            // 0-1
  entities: ExtractedEntity[];
  constraints: Constraint[];
  rawText: string;
}

function classifyIntent(text: string, context: ConversationContext): Intent {
  const lower = text.toLowerCase();

  // Check for simulation intents (require @simul)
  const hasSimul = /@simul\b/.test(text);

  if (hasSimul) {
    if (/need|procure|source|supply|stock.*lost|restock/i.test(lower)) {
      return { type: 'SIMULATE_PROCUREMENT', confidence: 0.9, ... };
    }
    if (/route|ship|transfer|move.*from.*to/i.test(lower)) {
      return { type: 'SIMULATE_ROUTING', confidence: 0.9, ... };
    }
    if (/redistribute|rebalance|spread|equalise/i.test(lower)) {
      return { type: 'SIMULATE_REBALANCE', confidence: 0.85, ... };
    }
  }

  // Read-only intents
  if (/warehouse.*capacity|how full|status.*warehouse/i.test(lower)) {
    return { type: 'QUERY_WAREHOUSE', confidence: 0.8, ... };
  }
  // ... more patterns
}
```

**Option B — LLM-Assisted (Phase 3+):**
Send the message + schema description to an LLM for structured extraction. More flexible but adds latency and cost. This is a future enhancement once the rule-based system proves the concept.

---

## Entity Extraction

### Entity Types

| Entity Type | Examples | Resolved To |
|---|---|---|
| `WAREHOUSE_REF` | "Lahore warehouse", "WH-0005", "the main Punjab hub" | `warehouse_id` |
| `BUSINESS_REF` | "Sindh Cotton Mills", "BUS-0012" | `business_id` |
| `OBJECT_CATEGORY` | "Raw Cotton", "cotton", "Processed Silk" | `object_category` string |
| `REGION` | "Punjab", "Sindh", "Karachi", "Lahore" | region string + approximate coordinates |
| `QUANTITY` | "30 units", "fifty", "30" | `{ value: number, unit: string }` |
| `TIME_WINDOW` | "within 4 days", "by next week", "ASAP" | `{ days: number }` |
| `PROCESS_REF` | "cotton procurement", "PRC-01" | `process_id` |

### Extraction Patterns

```typescript
interface ExtractedEntity {
  type: string;
  rawValue: string;        // what the user typed
  resolvedValue: unknown;  // DB-ready value
  confidence: number;
}

// Warehouse reference extraction
function extractWarehouseRefs(text: string): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];

  // Direct ID reference: WH-0005
  const idMatches = text.matchAll(/WH-\d{4}/gi);
  for (const m of idMatches) {
    entities.push({
      type: 'WAREHOUSE_REF',
      rawValue: m[0],
      resolvedValue: m[0].toUpperCase(),
      confidence: 1.0,
    });
  }

  // Named reference: "Lahore warehouse", "the Karachi hub"
  const namedMatch = text.match(/([\w]+)\s+warehouse/i);
  if (namedMatch) {
    entities.push({
      type: 'WAREHOUSE_REF',
      rawValue: namedMatch[0],
      resolvedValue: null, // must be resolved via DB lookup
      confidence: 0.7,
    });
  }

  return entities;
}

// Quantity extraction
function extractQuantity(text: string): ExtractedEntity | null {
  const match = text.match(/(\d+)\s*(units?|kg|tonnes?|tons?)?/i);
  if (match) {
    return {
      type: 'QUANTITY',
      rawValue: match[0],
      resolvedValue: { value: parseInt(match[1]), unit: match[2] || 'units' },
      confidence: 0.95,
    };
  }
  return null;
}

// Time window extraction
function extractTimeWindow(text: string): ExtractedEntity | null {
  const match = text.match(/(?:within|in|by)\s+(\d+)\s*(days?|weeks?|hours?)/i);
  if (match) {
    let days = parseInt(match[1]);
    if (/weeks?/i.test(match[2])) days *= 7;
    return {
      type: 'TIME_WINDOW',
      rawValue: match[0],
      resolvedValue: { days },
      confidence: 0.9,
    };
  }

  if (/asap|immediately|urgent/i.test(text)) {
    return {
      type: 'TIME_WINDOW',
      rawValue: 'ASAP',
      resolvedValue: { days: 1 },
      confidence: 0.7,
    };
  }

  return null;
}
```

---

## Context Resolution

### The Problem

Users refer to things implicitly:
- "**that** warehouse" — which one?
- "the **nearest** supplier" — nearest to what?
- "**move it** there" — move what where?

### Resolution Strategy

The Context Resolver maintains a **focus stack** from conversation history:

```typescript
interface ConversationContext {
  // Recently mentioned entities, most recent first
  recentWarehouses: string[];     // warehouse_id[]
  recentBusinesses: string[];     // business_id[]
  recentCategories: string[];     // object_category[]
  recentRegions: string[];        // region names

  // Current simulation state (if active)
  activeSimulation: {
    sessionId: string;
    options: string[];            // option IDs
    intent: Intent;
  } | null;

  // User's role and associated data
  userRole: string;
  userRegion?: string;            // if role implies region focus
}
```

### Resolution Rules

| Pronoun / Reference | Resolution |
|---|---|
| "that warehouse" / "it" / "this one" | `recentWarehouses[0]` — most recently discussed warehouse |
| "the nearest" | Requires a reference point — use `recentWarehouses[0]` coordinates or user's region |
| "same category" / "same type" | `recentCategories[0]` |
| "option A" / "the first one" | `activeSimulation.options[0]` |
| "there" / "that location" | `recentRegions[0]` or `recentWarehouses[0].region` |

### Context Update Flow

After every message (user or agent), the context is updated:

```typescript
function updateContext(ctx: ConversationContext, message: AgentMessage, entities: ExtractedEntity[]): void {
  for (const entity of entities) {
    switch (entity.type) {
      case 'WAREHOUSE_REF':
        ctx.recentWarehouses.unshift(entity.resolvedValue as string);
        ctx.recentWarehouses = ctx.recentWarehouses.slice(0, 5); // keep last 5
        break;
      case 'BUSINESS_REF':
        ctx.recentBusinesses.unshift(entity.resolvedValue as string);
        ctx.recentBusinesses = ctx.recentBusinesses.slice(0, 5);
        break;
      case 'OBJECT_CATEGORY':
        ctx.recentCategories.unshift(entity.resolvedValue as string);
        ctx.recentCategories = ctx.recentCategories.slice(0, 3);
        break;
      case 'REGION':
        ctx.recentRegions.unshift(entity.resolvedValue as string);
        ctx.recentRegions = ctx.recentRegions.slice(0, 3);
        break;
    }
  }
}
```

---

## Geographic Understanding

### Region → Coordinates Mapping

A static lookup for coarse region resolution:

```typescript
const REGION_CENTERS: Record<string, [number, number]> = {
  'Punjab':          [31.1704, 72.7097],
  'Sindh':           [26.2461, 68.6741],
  'Lahore':          [31.5204, 74.3587],
  'Karachi':         [24.8607, 67.0011],
  'Islamabad':       [33.6844, 73.0479],
  'Faisalabad':      [31.4504, 73.1350],
  'Multan':          [30.1575, 71.5249],
  'Peshawar':        [34.0151, 71.5249],
  'Quetta':          [30.1798, 66.9750],
  'Hyderabad':       [25.3960, 68.3578],
};
```

### Proximity Queries

When the user says "nearest" or "nearby", the agent:

1. Determines the reference point (from context or explicit mention).
2. Queries using the Haversine function from DATABASE-LAYER.md:

```sql
SELECT business_id, region,
       haversine_km(coordinates[1], coordinates[2], $1, $2) AS distance_km
FROM businesses
WHERE object_category = $3
ORDER BY distance_km ASC
LIMIT 5;
```

3. Uses the distances to differentiate simulation options (e.g., Option A picks the 2 nearest, Option C picks the cheapest regardless of distance).

---

## Ambiguity Handling

When the NLU cannot confidently resolve an entity or intent:

### Low Confidence (< 0.5)

Ask the user for clarification:

```
Agent: I found 3 warehouses in Punjab. Which one do you mean?
  1. WH-0003 — Lahore Central (72% full)
  2. WH-0007 — Faisalabad North (45% full)
  3. WH-0011 — Multan South (91% full)
```

### Medium Confidence (0.5–0.8)

State the assumption and proceed, giving the user a chance to correct:

```
Agent: I'll assume you mean WH-0003 (Lahore Central) since it was
       mentioned earlier. Say "no, WH-0007" to change.
```

### High Confidence (> 0.8)

Proceed silently — include the resolved value in the response for transparency.

---

## Domain Vocabulary

The NLU must handle supply-chain synonyms:

| Canonical Term | Synonyms the User Might Use |
|---|---|
| `object` | item, stock, inventory, goods, product, material |
| `warehouse` | hub, depot, storage, facility, site |
| `business` | supplier, vendor, company, partner, source |
| `transit_status` | delivery status, shipping status, where is it |
| `capacity_used` | how full, occupancy, utilisation, fill level |
| `object_category` | type, kind, category, material type |
| `procurement` | buying, sourcing, ordering, restocking |
| `routing` | shipping, transfer, delivery, transport |

```typescript
const SYNONYM_MAP: Record<string, string> = {
  'item': 'object', 'stock': 'object', 'inventory': 'object',
  'goods': 'object', 'product': 'object', 'material': 'object',
  'hub': 'warehouse', 'depot': 'warehouse', 'storage': 'warehouse',
  'facility': 'warehouse', 'site': 'warehouse',
  'supplier': 'business', 'vendor': 'business', 'company': 'business',
  'partner': 'business', 'source': 'business',
  'buying': 'procurement', 'sourcing': 'procurement',
  'ordering': 'procurement', 'restocking': 'procurement',
  'shipping': 'routing', 'transfer': 'routing',
  'delivery': 'routing', 'transport': 'routing',
};
```
