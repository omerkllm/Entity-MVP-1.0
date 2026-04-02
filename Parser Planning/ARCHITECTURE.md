# Architecture

## System Overview

The Parser Agent sits between the frontend chat UI (`AIChatPanel`) and the Neon Postgres database. It orchestrates three layers:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND  (React / Next.js)                      │
│                                                                          │
│  ┌──────────────┐    ┌──────────────────┐    ┌───────────────────────┐   │
│  │ AIChatPanel   │◄──►│ SimulationCards   │◄──►│  OptionCommitDialog  │   │
│  │  (input +     │    │  (render the 2–3  │    │  (@proceed confirm)  │   │
│  │   messages)   │    │   option cards)   │    │                      │   │
│  └──────┬───────┘    └────────┬─────────┘    └──────────┬───────────┘   │
│         │                     │                          │               │
│─────────┼─────────────────────┼──────────────────────────┼───────────────│
│         ▼                     ▼                          ▼               │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │                    POST /api/agent/chat                           │    │
│  │                    POST /api/agent/simulate                       │    │
│  │                    POST /api/agent/proceed                        │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                       BACKEND  (Next.js API Routes)                      │
│                                                                          │
│  ┌─────────────────────┐                                                 │
│  │   Agent Orchestrator │  ← routes incoming request to correct handler  │
│  └──────┬──────────────┘                                                 │
│         │                                                                │
│         ├──► NLU Module ──────────► Intent + Entities                    │
│         │                                                                │
│         ├──► Query Planner ───────► SQL / View definitions               │
│         │                                                                │
│         ├──► Simulation Manager ──► Creates views, scores options         │
│         │                                                                │
│         ├──► Commit Manager ──────► Applies chosen option to real tables  │
│         │                                                                │
│         └──► Conversation Store ──► Per-session message history           │
│                                                                          │
└──────────────────────────┬───────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        NEON  POSTGRES  DB                                │
│                                                                          │
│  Real tables:  processes, warehouse, object, businesses, category, ...   │
│  Simulation views:  sim_{sessionId}_{optionId}_*                         │
│  (created on @simul, dropped on @proceed or timeout)                     │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### 1. Agent Orchestrator (`src/lib/agent/orchestrator.ts`)

The central router. Receives every chat message and decides what to do:

| Input pattern | Action |
|---|---|
| Free-text message (no command) | Pass to **NLU Module** → extract intent → generate informational response |
| Message contains `@simul` | Pass to **NLU Module** → extract intent → pass to **Simulation Manager** → return option cards |
| Message contains `@proceed` + option ID | Pass to **Commit Manager** → apply mutations → return confirmation |
| `@cancel` | Drop all simulation views for session → return confirmation |

### 2. NLU Module (`src/lib/agent/nlu/`)

Responsible for understanding what the user wants:

- **Intent Classifier** — what action? (query data, find businesses, simulate procurement, compare warehouses, etc.)
- **Entity Extractor** — what nouns? (warehouse IDs, regions like "Punjab" / "Sindh", object categories like "Raw Cotton", quantities, time windows)
- **Context Resolver** — resolves relative references ("that warehouse", "the nearest one") using conversation history + current DB state
- **Constraint Parser** — extracts numeric constraints (deadlines, quantities, capacity thresholds)

### 3. Query Planner (`src/lib/agent/planner/`)

Converts structured intents into executable SQL:

- **Read Planner** — SELECT queries for data lookups (which warehouses are in Punjab?, what's the capacity?)
- **View Planner** — CREATE VIEW statements for simulation branches
- **Mutation Planner** — UPDATE / INSERT statements for final commits
- **Geo Planner** — distance calculations between coordinates for "nearest business" queries

### 4. Simulation Manager (`src/lib/agent/simulation/`)

Orchestrates the `@simul` flow:

1. Takes the structured intent from NLU
2. Generates 2–3 strategy variants (optimal, moderate, risky)
3. For each variant, creates a set of DB views showing the projected state
4. Returns the option cards with summary text + preview data
5. Tracks active simulations per session for cleanup

### 5. Commit Manager (`src/lib/agent/commit/`)

Orchestrates the `@proceed` flow:

1. Validates the chosen option ID against an active simulation
2. Reads the mutations associated with that option
3. Executes them inside a DB transaction against real tables
4. Drops all simulation views for that session
5. Logs the action in `activity_log`

### 6. Conversation Store (`src/lib/agent/conversation/`)

- In-memory per-session message history (server-side, keyed by session token)
- Provides context window to NLU so it can resolve "that warehouse" → WH-0012
- Evicts after 30 min idle or on logout
- Optional: persist to a `conversations` table for audit

---

## Data Flow — Complete `@simul` → `@proceed` Cycle

```
Step 1: User sends message
  "My cotton warehouse in Punjab lost all stock. I need 30 units in 4 days.
   Which businesses should I reach out to? @simul"

Step 2: NLU extracts
  intent:     PROCUREMENT_SIMULATION
  entities:   { objectCategory: "Raw Cotton", region: "Punjab", quantity: 30,
                timeWindowDays: 4, constraint: "nearest businesses" }
  context:    { warehouseIds: ["WH-0005"], processId: "PRC-01" }

Step 3: Query Planner generates view SQL for 3 options
  Option A (Optimal):   View sourcing from 2 established suppliers in Punjab
  Option B (Moderate):  View sourcing from 1 Punjab + 1 Sindh supplier
  Option C (Risky):     View spot-market from unvetted brokers

Step 4: Simulation Manager
  - CREATE VIEW sim_abc123_opt_a_procurement AS ...
  - CREATE VIEW sim_abc123_opt_b_procurement AS ...
  - CREATE VIEW sim_abc123_opt_c_procurement AS ...
  - Queries each view to build summary cards

Step 5: Frontend renders 3 option cards

Step 6: User clicks Option A → sends "@proceed opt-a"

Step 7: Commit Manager
  - BEGIN TRANSACTION
  - INSERT/UPDATE real object & warehouse tables
  - INSERT into activity_log
  - DROP VIEW sim_abc123_opt_a_procurement
  - DROP VIEW sim_abc123_opt_b_procurement
  - DROP VIEW sim_abc123_opt_c_procurement
  - COMMIT

Step 8: Frontend shows confirmation + updated data
```

---

## Security Boundaries

| Concern | Mitigation |
|---|---|
| SQL injection in agent-generated queries | All SQL goes through parameterised `query()` helper — never raw string concat |
| Agent generates destructive DDL (`DROP TABLE`) | SQL allowlist: only `CREATE VIEW`, `DROP VIEW`, and DML (`SELECT/INSERT/UPDATE`) are permitted |
| Unauthorized data access | Agent inherits the user's JWT role. WO users cannot trigger simulations. |
| Runaway view accumulation | Background cron (or Neon scheduled query) drops `sim_*` views older than 1 hour |
| LLM prompt injection via user input | User input is placed in a structured JSON slot, never interpolated into system prompts |

---

## Folder Structure (Proposed)

```
src/lib/agent/
├── orchestrator.ts          # Central router
├── types.ts                 # Shared types (SimulationOption, Intent, Entity, etc.)
├── nlu/
│   ├── classifier.ts        # Intent classification
│   ├── extractor.ts         # Entity extraction
│   ├── context.ts           # Conversation context resolution
│   └── constraints.ts       # Numeric & temporal constraint parsing
├── planner/
│   ├── read.ts              # SELECT query generation
│   ├── view.ts              # CREATE VIEW generation
│   ├── mutation.ts          # INSERT/UPDATE generation
│   └── geo.ts               # Coordinate distance helpers
├── simulation/
│   ├── manager.ts           # Simulation lifecycle
│   ├── strategies.ts        # Option generation (optimal/moderate/risky)
│   └── scoring.ts           # Option ranking & risk assessment
├── commit/
│   ├── manager.ts           # Transaction execution
│   └── cleanup.ts           # View cleanup / TTL enforcement
└── conversation/
    ├── store.ts             # In-memory session store
    └── history.ts           # Context window builder
```
