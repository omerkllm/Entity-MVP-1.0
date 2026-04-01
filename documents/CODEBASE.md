# Entity — Supply Chain Management Codebase

## Tech Stack

- **Framework**: Next.js 16 (App Router) with React 19
- **Styling**: Tailwind CSS 4
- **Theme**: `next-themes` (light / dark mode)
- **Fonts**: Geist Sans + Geist Mono (bundled via `next/font`)
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL (via `pg` driver, singleton pool)
- **Auth**: JWT (HS256 via `jose`) + bcrypt password hashing
- **Middleware**: `proxy.ts` (Next.js 16 route protection)

## Project Structure

```
src/
├── proxy.ts                      # Route protector — auth + role checks
├── app/                          # Next.js App Router pages
│   ├── layout.tsx                # Root layout (fonts, theme, error boundary)
│   ├── page.tsx                  # Home → redirects to /login
│   ├── globals.css               # Tailwind imports + dark mode body styles
│   ├── login/page.tsx            # Login screen (auth via /api/auth/login)
│   ├── inventory/
│   │   ├── page.tsx              # Supply chain node list → links to warehousing
│   │   └── warehousing/page.tsx  # Warehousing table with filters + inspector
│   ├── supply-chain-dashboard/page.tsx  # Dashboard: stats, transit, capacity
│   ├── decision-making/page.tsx  # DMP: filters + map + AI agent chat
│   └── api/
│       ├── auth/
│       │   ├── login/route.ts    # POST — verify credentials, issue JWT
│       │   ├── logout/route.ts   # POST — clear auth cookies
│       │   ├── refresh/route.ts  # POST — refresh access token
│       │   └── session/route.ts  # GET — return current user role
│       ├── objects/route.ts      # GET — all objects (optional ?warehouseId=)
│       └── warehouses/route.ts   # GET — all warehouses joined with category
│
├── components/
│   ├── Sidebar.tsx               # Global sidebar navigation (role-aware)
│   ├── SupplyChainFlow.tsx       # SVG sankey-style graph (clickable nodes)
│   ├── WarehouseInspector.tsx     # Right-panel inspector for a warehouse row
│   ├── ObjectInspector.tsx        # Right-panel inspector for an object row
│   └── ui/                       # Shared generic UI primitives
│       ├── ErrorBoundary.tsx      # React error boundary wrapper
│       ├── FilterPanel.tsx        # CheckboxFilterSections, RangeFilter, DeleteFiltersButton
│       └── index.ts              # Barrel re-exports
│
├── lib/
│   ├── auth/                     # Authentication utilities
│   │   ├── cookies.ts            # Set/clear HttpOnly auth cookies
│   │   ├── hash.ts               # bcrypt hash/verify helpers
│   │   ├── jwt.ts                # JWT sign/verify (access + refresh tokens)
│   │   └── session.ts            # Read session from cookie
│   ├── data/                     # Data layer — types, JSON helpers, utilities
│   │   ├── types.ts              # All TypeScript type definitions
│   │   ├── helpers.ts            # Pure utility functions (capacity, health math)
│   │   ├── objects.ts            # Object records from JSON (legacy — used by JSON-dependent code)
│   │   ├── warehouses.ts         # Warehouse records from JSON (legacy — used by JSON-dependent code)
│   │   ├── supply-chain.ts       # Supply chain nodes + activity log from JSON
│   │   └── index.ts              # Barrel re-exports
│   └── db/                       # Database layer
│       ├── client.ts             # PostgreSQL Pool singleton (HMR-safe)
│       └── queries/
│           ├── objects.ts        # SQL queries for object table
│           └── warehouses.ts     # SQL queries for warehouse table (joined with category)
│
├── utils/
│   ├── filters.ts                # Generic filter helpers (derive, toggle, count, clear)
│   └── format.ts                 # Formatting helpers (padTwo, formatWarehouseName)
│
└── data/                         # Raw JSON data files (legacy — being migrated to DB)
    ├── objects-data.json          # Object records (used by lib/data/objects.ts)
    ├── object-relationships.json  # Object → warehouse mapping
    ├── warehousing-data.json      # Warehouse records (used by lib/data/warehouses.ts)
    ├── warehouse-relationships.json  # Warehouse → process/category mapping
    ├── supply-chain-nodes.json    # 8 supply chain process nodes (still JSON-sourced)
    ├── activity-log.json          # Recent activity feed entries (still JSON-sourced)
    ├── category-colors.json       # Colour mapping for object categories (UI-only)
    ├── dmp-filters.json           # Decision-making portal filter sections (UI-only)
    └── ai-agent-simulations.json  # AI agent conversation mockup (UI-only)
```

## Data Architecture

### Dual data sources (transitional state)

The project is migrating from JSON flat files to PostgreSQL. Currently:

| Data | Source | API Route | Pages Using |
|------|--------|-----------|-------------|
| Warehouses | **PostgreSQL** | `GET /api/warehouses` | SCD, Warehousing |
| Objects | **PostgreSQL** | `GET /api/objects` | SCD, Warehousing |
| Users/Auth | **PostgreSQL** | `POST /api/auth/*` | Login |
| Supply Chain Nodes | JSON (`supply-chain-nodes.json`) | *none yet* | Inventory, SCD, SupplyChainFlow |
| Activity Log | JSON (`activity-log.json`) | *none yet* | SCD |
| DMP Filters | JSON (`dmp-filters.json`) | — (UI-only) | DMP |
| AI Conversations | JSON (`ai-agent-simulations.json`) | — (mockup) | DMP |
| Category Colors | JSON (`category-colors.json`) | — (UI-only) | WarehouseInspector |

### Import strategy

Pages import utilities from specific sub-modules to avoid bundling unused JSON data:
- `@/lib/data/helpers` — pure math utilities (no JSON)
- `@/lib/data/supply-chain` — process nodes + activity (small JSON)
- `@/lib/data/types` — type definitions only (zero runtime)

Do NOT import from the barrel `@/lib/data` in page components — it pulls in all JSON files via `objects.ts` → `warehouses.ts` cascade.

### Key relationships

```
processes (PostgreSQL) ← seeded from supply-chain-nodes.json
  └─ category (PostgreSQL)
       └─ warehouse (PostgreSQL)
            └─ object (PostgreSQL)

supply-chain-nodes.json ← still read directly for UI nodes
  └─ used by SupplyChainFlow, inventory/page, SCD
```

## Data Sources

### Per-page data origin

| Page | PostgreSQL (via API) | Static JSON |
|------|----------------------|-------------|
| `/login` | `POST /api/auth/login` | — |
| `/inventory` | — | `supply-chain-nodes.json` (process list) |
| `/inventory/warehousing` | `GET /api/warehouses`, `GET /api/objects` | — |
| `/supply-chain-dashboard` | `GET /api/warehouses`, `GET /api/objects`, `GET /api/activity`, `GET /api/businesses`, `GET /api/processes` | `supply-chain-nodes.json` (sankey nodes) |
| `/decision-making` | — | `dmp-filters.json` (filter panels), `ai-agent-simulations.json` (chat mock) |

### Migration timeline

- **`supply-chain-nodes.json`** — Currently read directly by `SupplyChainFlow`, `inventory/page`, and the supply-chain-dashboard. The data is already seeded into the `processes` table (canonical IDs: `PRC-01…PRC-08`). Migration target: add `GET /api/processes` client-side fetch to replace the JSON import once UI state management is updated (tracked in BACKLOG.md).
- **`dmp-filters.json`** — UI-only configuration; no migration planned.
- **`ai-agent-simulations.json`** — Placeholder for future AI agent integration; no migration planned.

---

## Authentication

- 4 seeded users: `admin/123` (SA), `analyst/123` (SCA), `commander/123` (SC), `operator/123` (WO)
- JWT access token (15m) + refresh token (7d) in HttpOnly cookies
- `proxy.ts` enforces route-level role restrictions
- Account lockout after 5 failed attempts (15m cooldown)

## Page Flows

### Login → Role-based routing
- SA / SCA → `/supply-chain-dashboard`
- SC → `/decision-making`
- WO → `/inventory/warehousing`

### Inventory → Warehousing (drill-down)
1. `/inventory` lists all supply chain nodes (from JSON)
2. Click a node → `/inventory/warehousing?process={nodeId}`
3. Table shows warehouses for that process (from DB)
4. Click a warehouse row → inspector panel opens
5. Double-click a warehouse row → drills into its objects (from DB)

### Supply Chain Dashboard
Stat cards, recent activity, sankey flow, transit distribution, and capacity charts.
Warehouses and objects from DB; supply chain nodes and activity from JSON.

### Decision Making Portal
Three-column layout: quick-action filters (from `dmp-filters.json`), map placeholder, AI agent chat panel (from `ai-agent-simulations.json`).

## Conventions

- All page components use `'use client'`
- Import types from `@/lib/data/types` (type-only, no bundle impact)
- Import pure utilities from `@/lib/data/helpers` (no JSON deps)
- Import supply chain data from `@/lib/data/supply-chain` (small JSON)
- Import DB data via API fetch in `useEffect` (not direct imports)
- Imports from `@/utils/*` for shared helpers
- Imports from `@/components/ui` for reusable UI primitives

## Running

```bash
cd entity
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run seed     # seed DB from JSON files
```

Requires `.env.local` with:
```
DATABASE_URL=postgresql://...
JWT_SECRET=<random 64-char string>
JWT_REFRESH_SECRET=<different random 64-char string>
```
