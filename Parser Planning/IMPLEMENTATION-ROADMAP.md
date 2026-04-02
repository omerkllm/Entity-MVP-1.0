# Implementation Roadmap

## Phase Overview

| Phase | Focus | Depends On | Estimated Scope |
|---|---|---|---|
| **Phase 1** | Foundation — API scaffold + message protocol | Nothing | 3 files, DB migration |
| **Phase 2** | NLU — Intent classification + entity extraction | Phase 1 | 5 files |
| **Phase 3** | Read Queries — Answer data questions from DB | Phase 2 | 2 files |
| **Phase 4** | Simulation Engine — `@simul` with DB views | Phase 3 | 4 files |
| **Phase 5** | Commit Engine — `@proceed` with transactions | Phase 4 | 2 files |
| **Phase 6** | Frontend Polish — Cards, UX, error states | Phase 5 | 3 files |
| **Phase 7** | Hardening — Rate limits, cleanup, logging | Phase 6 | 2 files |

---

## Phase 1: Foundation

**Goal:** Establish the API surface and message protocol so frontend and backend can communicate.

### Tasks

- [ ] Create `src/app/api/agent/chat/route.ts` — accepts messages, returns hardcoded echo response
- [ ] Create `src/app/api/agent/proceed/route.ts` — stub that returns 501
- [ ] Create `src/app/api/agent/cancel/route.ts` — stub that returns 501
- [ ] Create `src/lib/agent/orchestrator.ts` — skeleton that receives parsed command and dispatches
- [ ] Create `src/lib/agent/types.ts` — shared types (`Intent`, `ExtractedEntity`, `SimulationOption`, etc.)
- [ ] Add agent API types to `src/lib/data/types.ts` (`AgentChatRequest`, `AgentChatResponse`, etc.)
- [ ] Run DB migration: create `simulation_sessions` and `simulation_mutations` tables
- [ ] Update `src/proxy.ts` — add `/api/agent/*` routes to SA and SC role access maps
- [ ] Wire `AIChatPanel.tsx` — add `sessionId` state, send handler posting to `/api/agent/chat`, display responses

### Validation
- User can type a message in the chat panel and see an echo response from the API.
- Auth and role checks work (WO/SCA get 403).

---

## Phase 2: NLU

**Goal:** Parse natural language into structured intents and entities.

### Tasks

- [ ] Create `src/lib/agent/nlu/classifier.ts` — rule-based intent classification
- [ ] Create `src/lib/agent/nlu/extractor.ts` — entity extraction (warehouse refs, quantities, regions, time windows, categories)
- [ ] Create `src/lib/agent/nlu/context.ts` — conversation context store (focus stack of recent entities)
- [ ] Create `src/lib/agent/nlu/constraints.ts` — numeric and temporal constraint parsing
- [ ] Create `src/lib/agent/nlu/synonyms.ts` — domain vocabulary synonym map
- [ ] Integrate NLU into orchestrator — every message runs through classifier + extractor before dispatch
- [ ] Write unit tests for intent classification and entity extraction covering the key patterns from NLU-CONTEXT.md

### Validation
- Message "What's the capacity of WH-0005?" → intent: `QUERY_WAREHOUSE`, entity: `{ type: 'WAREHOUSE_REF', resolvedValue: 'WH-0005' }`
- Message "I need 30 units of Raw Cotton in 4 days @simul" → intent: `SIMULATE_PROCUREMENT`, entities: quantity 30, category "Raw Cotton", time window 4 days

---

## Phase 3: Read Queries

**Goal:** Answer informational questions by generating and executing SELECT queries.

### Tasks

- [ ] Create `src/lib/agent/planner/read.ts` — maps read intents to parameterised SELECT queries
- [ ] Create `src/lib/agent/planner/geo.ts` — Haversine distance helper + proximity query builder
- [ ] Create the `haversine_km` Postgres function (DB migration)
- [ ] Wire read planner into orchestrator — free-text messages (no command) go through NLU → read planner → query → formatted response
- [ ] Handle ambiguity: if entity resolution confidence < 0.5, return clarification message instead of query

### Validation
- "What's the capacity of the Lahore warehouse?" → returns live data from `warehouse` table
- "Which businesses supply Raw Cotton near Punjab?" → returns businesses sorted by distance
- "How much stock is in WH-0003?" → returns object summary from `object` table

---

## Phase 4: Simulation Engine

**Goal:** `@simul` creates DB views and returns 2–3 option cards.

### Tasks

- [ ] Create `src/lib/agent/planner/view.ts` — generates CREATE VIEW SQL from structured intents
- [ ] Create `src/lib/agent/simulation/manager.ts` — lifecycle management (create views, track state, handle TTL)
- [ ] Create `src/lib/agent/simulation/strategies.ts` — option generation logic (optimal / moderate / risky archetypes)
- [ ] Create `src/lib/agent/simulation/scoring.ts` — risk / benefit scoring for each option
- [ ] Implement `validateQuery()` in `src/lib/agent/planner/validation.ts` — SQL allowlist enforcement
- [ ] Wire simulation flow: `@simul` message → NLU → view planner → create views → query previews → return option cards
- [ ] Store simulation metadata in `simulation_sessions` table
- [ ] Store planned mutations in `simulation_mutations` table
- [ ] Implement auto-cleanup: if user sends new `@simul`, drop previous simulation's views first

### Validation
- "I need 30 units of Raw Cotton in 4 days @simul" → 2–3 option cards returned, views visible in `pg_catalog.pg_views`
- Views are namespaced correctly: `sim_{sessionId}_{optionId}_{tableName}`
- Forbidden SQL (DROP TABLE, DELETE) is rejected by the validator

---

## Phase 5: Commit Engine

**Goal:** `@proceed` applies the chosen option to real tables and cleans up views.

### Tasks

- [ ] Create `src/lib/agent/commit/manager.ts` — reads mutations from `simulation_mutations`, executes in transaction, logs to `activity_log`
- [ ] Create `src/lib/agent/commit/cleanup.ts` — drops all views for a session, updates `simulation_sessions` status
- [ ] Wire `@proceed` in orchestrator and `/api/agent/proceed` route
- [ ] Wire `@cancel` in orchestrator and `/api/agent/cancel` route
- [ ] Implement `@status` command — returns active simulation summary

### Validation
- `@proceed opt-a` → real tables updated, views dropped, `activity_log` entry created, `simulation_sessions` marked committed
- `@cancel` → views dropped, session marked cancelled, no real table changes
- `@proceed` without active simulation → returns `NO_ACTIVE_SIMULATION` error
- Transaction rollback on failure — views preserved, user can retry

---

## Phase 6: Frontend Polish

**Goal:** Rich UI for simulation options, commit confirmation, and error states.

### Tasks

- [ ] Create `src/components/ai/SimulationCard.tsx` — renders option card with color border, title, points, select button
- [ ] Update `AIChatPanel.tsx` — render `SimulationCard` components when message has `options`, add cancel button during active simulation
- [ ] Add commit confirmation dialog — "Are you sure you want to apply Option A?" before calling `/api/agent/proceed`
- [ ] Add loading states — spinner during simulation generation (can take 2–3s), disable input during processing
- [ ] Add error display — toast or inline message for API errors (role denied, expired simulation, etc.)
- [ ] Add `@status` indicator — show timer/badge when a simulation is active with remaining TTL

### Validation
- Option cards render with correct colors (green/yellow/red) and are clickable
- Clicking an option shows confirmation dialog, then commits on confirm
- Cancel button drops simulation and clears option cards from chat
- Error states display cleanly without breaking the chat flow

---

## Phase 7: Hardening

**Goal:** Production readiness — rate limits, cleanup automation, audit logging.

### Tasks

- [ ] Implement rate limiting (in-memory counters per userId, configurable limits from API-INTEGRATION.md)
- [ ] Set up TTL cleanup — Vercel cron job or Neon scheduled query that runs every 15 minutes to drop expired `sim_*` views
- [ ] Add structured logging — log every agent action (intent classified, views created, commit executed) with timestamps and user IDs
- [ ] Add session cleanup on logout — call view cleanup when JWT refresh fails or user logs out
- [ ] Review and test SQL injection vectors — ensure all paths go through `validateQuery` and parameterised `query()`
- [ ] Load testing — simulate 10 concurrent users running simulations to verify view isolation and no name collisions

### Validation
- Exceeding rate limit returns 429 with retry-after header
- Views older than 60 minutes are automatically dropped
- All agent actions appear in structured logs
- No SQL injection possible through any user input path

---

## Dependency Graph

```
Phase 1 ─────► Phase 2 ─────► Phase 3 ─────► Phase 4 ─────► Phase 5 ─────► Phase 6 ─────► Phase 7
Foundation      NLU            Read Queries    Simulation      Commit          Frontend       Hardening
                                                Engine          Engine         Polish
```

Each phase is independently deployable. After Phase 3, the agent is useful for read-only data queries. After Phase 5, the full simulation workflow is functional. Phase 6 and 7 are polish.

---

## Files Created Per Phase

| Phase | New Files | Modified Files |
|---|---|---|
| 1 | `api/agent/chat/route.ts`, `api/agent/proceed/route.ts`, `api/agent/cancel/route.ts`, `lib/agent/orchestrator.ts`, `lib/agent/types.ts` | `proxy.ts`, `lib/data/types.ts`, `components/ai/AIChatPanel.tsx`, DB migration |
| 2 | `lib/agent/nlu/classifier.ts`, `extractor.ts`, `context.ts`, `constraints.ts`, `synonyms.ts` | `lib/agent/orchestrator.ts` |
| 3 | `lib/agent/planner/read.ts`, `planner/geo.ts` | `lib/agent/orchestrator.ts`, DB migration |
| 4 | `lib/agent/planner/view.ts`, `planner/validation.ts`, `simulation/manager.ts`, `simulation/strategies.ts`, `simulation/scoring.ts` | `lib/agent/orchestrator.ts` |
| 5 | `lib/agent/commit/manager.ts`, `commit/cleanup.ts` | `lib/agent/orchestrator.ts`, `api/agent/proceed/route.ts`, `api/agent/cancel/route.ts` |
| 6 | `components/ai/SimulationCard.tsx` | `components/ai/AIChatPanel.tsx` |
| 7 | — | Rate limit middleware, cron job config |

---

## Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Neon doesn't support views over HTTP driver | Blocks Phase 4 entirely | Test early in Phase 1 with a spike: `CREATE VIEW test AS SELECT 1` via `query()`. Fallback: use temp tables. |
| NLU rule-based system too brittle for real users | Poor UX in Phase 2–3 | Start with constrained vocabulary + examples in the UI. Plan LLM upgrade for post-MVP. |
| View accumulation crashes Neon free tier | DB unavailability | Aggressive TTL (60 min), limit to 1 active simulation per user, cleanup on every session end. |
| Transaction isolation issues during concurrent simulations | Data corruption | Each simulation has unique prefix. Commits use serialisable transactions. Test with concurrent load in Phase 7. |
| Vercel 10s function timeout exceeded by complex simulations | 504 errors | Pre-compute most of the work during `@simul` (store mutations). `@proceed` just replays stored mutations — should be fast. |
