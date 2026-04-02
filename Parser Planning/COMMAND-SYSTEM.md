# Command System

## Overview

The Parser Agent recognises **command prefixes** (`@simul`, `@proceed`, `@cancel`) mixed into natural-language messages. Everything else is treated as an informational query answered directly.

---

## Command Reference

### `@simul` — Create Simulation

**Purpose:** Generate 2–3 strategic options as database views and present them as cards.

**Syntax:**
```
<natural language description of the scenario> @simul
```

**Examples:**
```
My Punjab cotton warehouse lost all stock.
I need 30 units of Raw Cotton within 4 days from the nearest suppliers. @simul
```
```
Compare routing options for 50 units of Processed Silk from Sindh to Lahore. @simul
```

**Processing steps:**
1. NLU extracts the intent, entities, and constraints from the surrounding text.
2. Query Planner generates SQL view definitions for each option.
3. Simulation Manager executes `CREATE VIEW sim_{sessionId}_{optionId}_*` statements.
4. Simulation Manager queries each view to produce summary data.
5. Response contains 2–3 `AgentOption` cards with:
   - `id` — option identifier (e.g., `opt-a`, `opt-b`, `opt-c`)
   - `title` — short label (e.g., "Optimal: 2 Punjab suppliers")
   - `color` — green / yellow / red
   - `points` — array of summary bullets
   - `preview` — key numbers pulled from the view (quantity, cost, ETA, etc.)

**Constraints:**
- Maximum 3 options per simulation.
- Only roles SA and SC may trigger `@simul`.
- Only one active simulation per session at a time. Sending a new `@simul` automatically cancels any pending one.
- Views are auto-dropped after **60 minutes** if neither `@proceed` nor `@cancel` is sent.

---

### `@proceed` — Commit Simulation

**Purpose:** Apply the chosen simulation option to real database tables, drop all simulation views.

**Syntax:**
```
@proceed <optionId>
```

**Examples:**
```
@proceed opt-a
```
```
I'll go with option B. @proceed opt-b
```

**Processing steps:**
1. Orchestrator validates that `optionId` belongs to the current active simulation.
2. Commit Manager retrieves the planned mutations for that option.
3. Commit Manager wraps mutations in a DB transaction:
   - `BEGIN`
   - Execute INSERT / UPDATE statements against real tables
   - Log action in `activity_log` (event_type: `SIMULATION_COMMIT`, node_id: relevant warehouse/object)
   - `COMMIT`
4. After successful commit, Simulation Manager drops **all** views for the session.
5. Response includes:
   - Confirmation message with a summary of what changed
   - `progress` field showing affected table counts
   - Updated data snapshot (e.g., new warehouse capacity, new object records)

**Error handling:**
- If the commit fails, the transaction is rolled back. Views are preserved so the user can retry or cancel.
- If the option ID is invalid, the agent lists valid option IDs.

---

### `@cancel` — Cancel Simulation

**Purpose:** Discard all simulation views without committing any changes.

**Syntax:**
```
@cancel
```

**Processing steps:**
1. Simulation Manager identifies all `sim_{sessionId}_*` views.
2. Drops them in a single batch (`DROP VIEW IF EXISTS ...`).
3. Clears the simulation state from the conversation store.
4. Response confirms cancellation.

---

### `@status` — Check Simulation Status

**Purpose:** Show the current state of any active simulation.

**Syntax:**
```
@status
```

**Response includes:**
- Whether a simulation is active
- How many options are pending
- Time remaining before auto-cleanup
- Option summaries for quick recap

---

## Free-Text Messages (No Command)

When a message contains no command prefix, the agent:

1. Passes it through NLU to understand the query.
2. Generates a read-only SQL query (SELECT only, no mutations).
3. Returns a conversational answer with data from the database.

**Examples:**
```
User: What's the current capacity of the Lahore warehouse?
Agent: Warehouse WH-0003 (Lahore) is at 72% capacity — 360/500 units used.
```

```
User: Which businesses supply Raw Cotton in Sindh?
Agent: 3 businesses supply Raw Cotton in Sindh:
       1. BUS-0012 – Sindh Cotton Mills (Karachi)
       2. BUS-0018 – Thar Cotton Co. (Tharparkar)
       3. BUS-0025 – Delta Fibres (Thatta)
```

---

## Command Detection Logic

```typescript
interface ParsedCommand {
  command: '@simul' | '@proceed' | '@cancel' | '@status' | null;
  optionId?: string;    // Only for @proceed
  freeText: string;     // The natural-language portion
}

function parseCommand(input: string): ParsedCommand {
  const trimmed = input.trim();

  // @proceed with option ID
  const proceedMatch = trimmed.match(/@proceed\s+(opt-[a-c])/i);
  if (proceedMatch) {
    return {
      command: '@proceed',
      optionId: proceedMatch[1].toLowerCase(),
      freeText: trimmed.replace(/@proceed\s+opt-[a-c]/i, '').trim(),
    };
  }

  if (/@simul\b/i.test(trimmed)) {
    return {
      command: '@simul',
      freeText: trimmed.replace(/@simul/i, '').trim(),
    };
  }

  if (/@cancel\b/i.test(trimmed)) {
    return { command: '@cancel', freeText: '' };
  }

  if (/@status\b/i.test(trimmed)) {
    return { command: '@status', freeText: '' };
  }

  return { command: null, freeText: trimmed };
}
```

---

## Message Protocol (Frontend ↔ API)

### Request Body (`POST /api/agent/chat`)

```typescript
interface AgentChatRequest {
  message: string;          // Raw input including any command
  sessionId: string;        // Conversation session ID
}
```

### Response Body

```typescript
interface AgentChatResponse {
  messages: AgentMessage[];  // 1 or more response messages
  simulation?: {
    id: string;
    options: AgentOption[];
    expiresAt: string;       // ISO timestamp
  };
  committed?: {
    optionId: string;
    summary: string;
    affectedRows: Record<string, number>; // e.g. { object: 2, warehouse: 1 }
  };
}
```

---

## Error Response Codes

| Code | Meaning |
|---|---|
| `NO_ACTIVE_SIMULATION` | `@proceed` or `@cancel` sent without an active simulation |
| `INVALID_OPTION_ID` | `@proceed opt-x` where `x` is not a/b/c or doesn't exist |
| `SIMULATION_EXPIRED` | Views were already auto-dropped (>60 min) |
| `INSUFFICIENT_ROLE` | User's role (WO/SCA) cannot trigger simulations |
| `QUERY_GENERATION_FAILED` | NLU could not produce a valid SQL plan for the input |
| `COMMIT_FAILED` | Transaction rolled back — views preserved for retry |
