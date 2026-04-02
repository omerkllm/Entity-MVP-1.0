# Parser Agent — Development Planning

> The Parser Agent is the AI-powered decision-making engine inside Entity's Decision Making Portal.  
> It understands natural-language supply chain queries, generates simulation options backed by real database views, and commits the user's chosen strategy into the live system.

---

## Documents

| Doc | Purpose |
|-----|---------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | High-level system design, data flow, component map |
| [COMMAND-SYSTEM.md](./COMMAND-SYSTEM.md) | `@simul`, `@proceed`, and other slash-commands |
| [SIMULATION-ENGINE.md](./SIMULATION-ENGINE.md) | How simulations are created, run, and finalized via DB views |
| [DATABASE-LAYER.md](./DATABASE-LAYER.md) | SQL generation, view lifecycle, schema extensions |
| [NLU-CONTEXT.md](./NLU-CONTEXT.md) | Natural language understanding, intent extraction, entity resolution |
| [API-INTEGRATION.md](./API-INTEGRATION.md) | Backend API routes, frontend ↔ agent protocol |
| [IMPLEMENTATION-ROADMAP.md](./IMPLEMENTATION-ROADMAP.md) | Phased development plan with milestones |

---

## Core Concept

```
User types natural language
        │
        ▼
  ┌─────────────┐
  │  NLU Layer   │  ← intent + entity extraction
  └──────┬──────┘
         │
         ▼
  ┌─────────────────┐
  │  Query Planner   │  ← converts intent into SQL / view definitions
  └──────┬──────────┘
         │
         ▼
  ┌──────────────────────┐
  │  @simul — Simulation  │  ← creates temp DB views, returns 2–3 options
  └──────┬───────────────┘
         │  user picks one
         ▼
  ┌──────────────────────┐
  │ @proceed — Commit     │  ← applies mutations to real tables, drops views
  └──────────────────────┘
```

## Constraints

- **Database**: Neon Postgres (serverless, HTTP driver). Views must be session-scoped or cleaned up deterministically.
- **Auth**: All agent actions execute under the authenticated user's role. SA/SC roles only.
- **Latency**: Simulation generation should feel near-instant (< 3 s target). LLM calls are the bottleneck.
- **Safety**: Agent-generated SQL must NEVER execute DDL beyond `CREATE/DROP TEMP VIEW`. All mutations go through parameterised query helpers.
