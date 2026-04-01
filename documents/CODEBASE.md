# Entity — Supply Chain Management Codebase

## Tech Stack

- **Framework**: Next.js 16.2.2 (App Router) with React 19
- **Styling**: Tailwind CSS 4 (Oxide engine, CSS-first config)
- **Theme**: `next-themes` (dark mode)
- **Language**: TypeScript 5 (strict mode, ES2020, ESM)
- **Database**: Neon PostgreSQL via `@neondatabase/serverless` HTTP driver
- **Auth**: JWT (HS256 via `jose`) + bcrypt (`@node-rs/bcrypt`) + TOTP MFA (`otplib`)
- **Middleware**: `proxy.ts` (Edge Runtime route protection + role-based access)
- **HTTP Client**: `axios` with auto-refresh interceptor
- **Maps**: `maplibre-gl` with MapTiler Dark tiles
- **Charts**: `recharts` (SVG-based)
- **Validation**: `zod` (runtime schema validation)
- **Deployment**: Vercel (serverless functions + Edge network)

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
│       │   ├── mfa/route.ts      # POST — verify TOTP code, issue tokens
│       │   ├── refresh/route.ts  # POST — refresh access token
│       │   └── session/route.ts  # GET — return current user role
│       ├── activity/route.ts     # GET — activity log entries
│       ├── businesses/route.ts   # GET — business partners (SC, SCA, SA)
│       ├── categories/route.ts   # GET — item categories
│       ├── dashboard/route.ts    # GET — dashboard stats (SCA, SA)
│       ├── dmp-data/route.ts     # GET — combined: warehouses + businesses (DMP page)
│       ├── objects/route.ts      # GET — inventory objects (?warehouseId= filter)
│       ├── processes/route.ts    # GET — supply chain processes
│       ├── scd-data/route.ts     # GET — combined: processes + activity + warehouses + dashboard (SCD page)
│       ├── warehouses/route.ts   # GET — all warehouses
│       └── warehousing-data/route.ts  # GET — combined: warehouses + processes (warehousing page)
│
├── components/
│   ├── Sidebar.tsx               # Global sidebar navigation (role-aware)
│   ├── SupplyChainFlow.tsx       # SVG sankey-style graph (clickable nodes)
│   ├── BusinessInspector.tsx     # Right-panel inspector for a business row
│   ├── WarehouseInspector.tsx    # Right-panel inspector for a warehouse row
│   ├── ObjectInspector.tsx       # Right-panel inspector for an object row
│   ├── DmpMap.tsx                # MapLibre GL map (Decision Making Portal)
│   ├── ai/
│   │   ├── AIChatPanel.tsx       # AI agent chat panel
│   │   └── index.ts             # Barrel re-exports
│   ├── map/
│   │   ├── geo.ts               # Coordinate parsing utilities
│   │   ├── layers.ts            # Map layer rendering (pins, arrows, labels)
│   │   ├── MapKeyMissing.tsx    # Missing API key fallback UI
│   │   └── types.ts             # Map-related TypeScript types
│   ├── supply-chain/
│   │   ├── constants.ts         # Supply chain flow constants
│   │   ├── flow-pieces.ts       # Flow piece definitions
│   │   └── FlowPiece.tsx        # Individual flow piece component
│   └── ui/                       # Shared generic UI primitives
│       ├── ErrorBoundary.tsx     # React error boundary wrapper
│       ├── FilterPanel.tsx       # CheckboxFilterSections, RangeFilter, DeleteFiltersButton
│       ├── ResizablePanel.tsx    # Resizable side panel
│       └── index.ts             # Barrel re-exports
│
├── lib/
│   ├── api-response.ts           # apiSuccess (cached), apiNoCache, apiError helpers
│   ├── api.ts                    # axios instance with refresh-token interceptor
│   ├── env.ts                    # Environment variable validation at startup
│   ├── auth/                     # Authentication utilities
│   │   ├── cookies.ts            # Set/clear HttpOnly auth cookies
│   │   ├── hash.ts               # bcrypt hash/verify helpers
│   │   ├── jwt.ts                # JWT sign/verify (access + refresh + MFA tokens)
│   │   └── session.ts            # Read session from cookie
│   ├── data/                     # Data layer — types, JSON helpers, utilities
│   │   ├── types.ts              # All TypeScript type definitions
│   │   ├── helpers.ts            # Pure utility functions (capacity, health math)
│   │   └── index.ts              # Barrel re-exports
│   └── db/                       # Database layer
│       ├── client.ts             # Neon HTTP driver (`neon()`) — zero-connection-overhead queries
│       ├── pagination.ts         # Pagination params parsing + result extraction
│       └── queries/
│           ├── activity.ts       # SQL queries for activity_log table
│           ├── businesses.ts     # SQL queries for businesses table
│           ├── categories.ts     # SQL queries for category table
│           ├── dashboard.ts      # SQL queries for dashboard aggregate stats
│           ├── objects.ts        # SQL queries for object table
│           ├── processes.ts      # SQL queries for processes table
│           └── warehouses.ts     # SQL queries for warehouse table
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

### All data from PostgreSQL

All business data is served from Neon PostgreSQL via API routes. No JSON files are used as primary data sources for pages.

| Data | API Route | Pages Using |
|------|-----------|-------------|
| User Auth | `POST /api/auth/login`, `/mfa`, `/refresh`, `/logout` | Login |
| Session | `GET /api/auth/session` | All (via middleware) |
| Warehouses | `GET /api/warehouses` | SCD, Warehousing, DMP |
| Objects | `GET /api/objects` | Warehousing |
| Processes | `GET /api/processes` | Inventory, Warehousing |
| Businesses | `GET /api/businesses` | DMP |
| Activity Log | `GET /api/activity` | SCD |
| Dashboard Stats | `GET /api/dashboard` | SCD |
| Combined SCD | `GET /api/scd-data` | Supply Chain Dashboard |
| Combined DMP | `GET /api/dmp-data` | Decision Making Portal |
| Combined Warehousing | `GET /api/warehousing-data` | Inventory/Warehousing |

### Static JSON (UI-only, not business data)

| File | Purpose |
|------|---------|
| `dmp-filters.json` | Filter panel configuration for DMP page |
| `ai-agent-simulations.json` | Mock AI agent conversations |
| `category-colors.json` | Colour mapping for UI styling |

### Combined endpoints (performance)

To reduce serverless cold starts, pages use combined endpoints that run multiple queries in `Promise.all()` within a single function invocation:

| Endpoint | Queries | Page |
|----------|---------|------|
| `/api/scd-data` | processes + activity + warehouses + dashboard | Supply Chain Dashboard |
| `/api/dmp-data` | warehouses + businesses | Decision Making Portal |
| `/api/warehousing-data` | warehouses + processes | Inventory/Warehousing |

### Database schema (9 tables)

```
processes (self-referencing next_process FK)
  └─ category (prominence tiers per process)
       └─ warehouse (with generated capacity_pct column)
            └─ object (inventory items)
                 └─ object_relationships (many-to-many linkages)
            └─ timeline (arrival/departure tracking)
       └─ businesses (external partners)
  └─ activity_log (audit trail)
users (role-based accounts: SA, SCA, SC, WO)
```

## Data Sources

### Per-page data origin

| Page | API Endpoint | Static JSON |
|------|-------------|-------------|
| `/login` | `POST /api/auth/login` | — |
| `/inventory` | `GET /api/warehousing-data` (combined) | — |
| `/inventory/warehousing` | `GET /api/warehousing-data` (combined) | — |
| `/supply-chain-dashboard` | `GET /api/scd-data` (combined) | — |
| `/decision-making` | `GET /api/dmp-data` (combined) | `dmp-filters.json`, `ai-agent-simulations.json` |

---

## Authentication

- 4 seeded users: `admin/123` (SA), `analyst/123` (SCA), `commander/123` (SC), `operator/123` (WO)
- JWT access token (15m) + refresh token (7d) + MFA token (5m) in HttpOnly cookies
- `jose` (HS256) — Edge Runtime compatible, zero dependencies
- `@node-rs/bcrypt` — Rust-native, 12 rounds, non-blocking
- `otplib` — TOTP MFA (RFC 6238) with authenticator apps
- `proxy.ts` (Edge Runtime) enforces route-level role restrictions
- Account lockout after 5 failed attempts (15m cooldown)
- Rate limiter: max 10 login attempts per IP per 60 seconds
- All auth responses use `Cache-Control: no-store` (never cached)
- `entity-role` cookie is non-HttpOnly so Sidebar reads role client-side

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
All data from a single `GET /api/scd-data` call (processes, activity, warehouses, dashboard stats).

### Decision Making Portal
Three-column layout: quick-action filters (from `dmp-filters.json`), MapLibre GL map with warehouse/business pins, AI agent chat panel (from `ai-agent-simulations.json`).
Map + business data from a single `GET /api/dmp-data` call.

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
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run seed     # seed DB from JSON seed files
```

Requires `.env.local` with:
```
DATABASE_URL=postgresql://...    # Neon connection string
JWT_SECRET=<random 64-char string>
JWT_REFRESH_SECRET=<different random 64-char string>
ENCRYPTION_SECRET=<random string>
NEXT_PUBLIC_MAPTILER_KEY=<maptiler api key>
```

### Scripts

| Command | File | Purpose |
|---------|------|---------|
| `npm run seed` | `scripts/seed.ts` | Seed all tables from JSON files in `scripts/seed-data/` |
| — | `scripts/create-schema.ts` | Idempotent DDL to create all 9 tables (run manually via `npx tsx scripts/create-schema.ts`) |
