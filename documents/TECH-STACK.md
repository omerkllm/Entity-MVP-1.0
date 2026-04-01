# Entity MVP — Tech Stack Reference

> Complete documentation of every technology, library, and configuration choice in the Entity supply-chain management platform and why each is optimal for a Next.js + React serverless deployment.

---

## Table of Contents

1. [Runtime & Framework](#1-runtime--framework)
2. [Language & Compiler](#2-language--compiler)
3. [Styling](#3-styling)
4. [Database](#4-database)
5. [Authentication & Security](#5-authentication--security)
6. [HTTP Client](#6-http-client)
7. [Visualisation](#7-visualisation)
8. [Validation](#8-validation)
9. [Theme Management](#9-theme-management)
10. [Linting & Code Quality](#10-linting--code-quality)
11. [Build & Dev Tooling](#11-build--dev-tooling)
12. [Deployment & Caching](#12-deployment--caching)
13. [Environment & Configuration](#13-environment--configuration)
14. [Architecture Decisions](#14-architecture-decisions)
15. [Dependency Audit & Cleanup](#15-dependency-audit--cleanup)

---

## 1. Runtime & Framework

### Next.js `16.2.2`

| Aspect | Detail |
|---|---|
| Role | Full-stack React framework — serves pages, API routes, and edge middleware in one deployable unit |
| Router | **App Router** (`src/app/`) with file-system routing |
| Rendering | All page components use `'use client'` — client-side rendering after initial HTML shell |
| Middleware | `src/proxy.ts` runs on the **Edge Runtime** for auth gating before the request reaches Node.js |
| Bundler | **Turbopack** (see §11) — enabled in `next.config.ts` |
| API layer | Route Handlers in `src/app/api/` — each runs as an independent Vercel serverless function |

**Why Next.js for this project:**

- **Unified deployment** — pages, API routes, and middleware all deploy as one Vercel project. No separate backend server to manage.
- **Edge middleware** — the auth proxy (`proxy.ts`) runs at the CDN edge, rejecting unauthenticated requests before they hit a serverless function (zero cold-start cost for blocked requests).
- **File-based routing** maps directly to the app's four main views (`/login`, `/supply-chain-dashboard`, `/decision-making`, `/inventory`).
- **Serverless-first** — each API route is an isolated function. Scales to zero when idle, scales out horizontally under load.

**Configuration** (`next.config.ts`):

```ts
import type { NextConfig } from "next";
import { resolve } from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: resolve(import.meta.dirname),
  },
};
```

The `root` field ensures Turbopack resolves the project root correctly when `import.meta.dirname` differs from `process.cwd()` (common in monorepo-like setups).

---

### React `19.2.3`

| Aspect | Detail |
|---|---|
| Role | UI rendering library |
| Hooks used | `useState`, `useEffect`, `useCallback`, `useRef` |
| Concurrent features | React 19 enables automatic batching and transitions for smoother UI updates |

**Why React 19:**

- **Automatic batching** — multiple `setState` calls inside event handlers, timeouts, and promises are batched into a single re-render. Critical for the dashboard pages that update several state variables when API data arrives.
- **Improved Suspense** — works with the App Router's streaming architecture.
- **`use` hook** (React 19) — enables reading promises and context directly in render, simplifying data-fetching patterns.
- **Ecosystem lock-in** — Next.js 16 requires React 19. Staying on the same major version avoids compatibility issues.

---

## 2. Language & Compiler

### TypeScript `5.x`

| Aspect | Detail |
|---|---|
| Config file | `tsconfig.json` |
| Target | `ES2020` |
| Module system | `esnext` with `bundler` module resolution |
| Strict mode | `true` — enables `strictNullChecks`, `noImplicitAny`, etc. |
| JSX | `react-jsx` (automatic runtime — no `import React` needed) |
| Path alias | `@/*` → `./src/*` |
| Incremental | `true` — TypeScript reuses previous compilation results |
| ESM | `"type": "module"` in `package.json` |

**Why these settings are optimal:**

- **`target: ES2020`** — covers optional chaining (`?.`), nullish coalescing (`??`), `BigInt`, and `Promise.allSettled`. The Vercel Node.js runtime (18+) supports all ES2020 features natively, so no unnecessary transpilation.
- **`moduleResolution: bundler`** — tells TypeScript to resolve imports the way Turbopack/webpack does, supporting `package.json` `exports` fields, `.ts` extension imports, and conditional exports.
- **`strict: true`** — catches `null`/`undefined` errors at compile time. Essential for a supply-chain app where missing data could mean incorrect inventory counts.
- **`isolatedModules: true`** — required for Turbopack and SWC, which transpile files individually without cross-file type information.
- **`resolveJsonModule: true`** — enables importing `.json` seed data files (`ai-agent-simulations.json`, `category-colors.json`, etc.) with full type inference.

---

## 3. Styling

### Tailwind CSS `4.x`

| Aspect | Detail |
|---|---|
| Integration | `@tailwindcss/postcss` plugin (PostCSS-based) |
| Config | Zero-config — Tailwind 4 uses CSS-first configuration via `@import "tailwindcss"` |
| PostCSS file | `postcss.config.mjs` |

**PostCSS configuration:**

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

**Why Tailwind CSS 4:**

- **Zero-config** — Tailwind 4 eliminates `tailwind.config.js`. All customisation happens in CSS using `@theme` directives. Reduces the number of config files in the project.
- **CSS-first** — dark mode variables, colour tokens, and spacing scales are defined directly in `globals.css` using standard CSS custom properties.
- **Oxide engine** — Tailwind 4's new Rust-based engine scans source files faster and produces smaller CSS output. Works seamlessly with Turbopack's fast refresh.
- **Tree-shaking** — only utility classes actually used in JSX are included in the production bundle.
- **Dark mode** — the app uses `class="dark"` on `<html>`, and Tailwind 4 supports `dark:` variants out of the box.

**Theme setup** (`globals.css`):

```css
@import "tailwindcss";
@import "maplibre-gl/dist/maplibre-gl.css";

html { color-scheme: dark; }
```

Custom CSS variables define the colour palette (`--sidebar-bg`, `--card-bg`, `--accent-blue`, etc.) directly in CSS, letting Tailwind's `var()` references stay framework-agnostic.

---

## 4. Database

### Neon PostgreSQL (via `@neondatabase/serverless` `1.0.2`)

| Aspect | Detail |
|---|---|
| Provider | [Neon](https://neon.tech) — serverless PostgreSQL |
| Region | `ap-southeast-1` (Singapore) |
| Driver | `neon()` HTTP query function — **not** a connection pool |
| ORM | None — raw SQL with parameterised queries |
| Schema management | Idempotent DDL script (`scripts/create-schema.ts`) |
| Seeding | `scripts/seed.ts` via `tsx` |

**Why `neon()` HTTP function over `pg.Pool`:**

| Metric | `pg.Pool` (WebSocket) | `neon()` HTTP |
|---|---|---|
| Cold start overhead | ~150-300ms (TCP + TLS + WebSocket handshake) | ~0ms (single HTTPS request) |
| Connection state | Stateful — must maintain pool, handle timeouts | Stateless — each query is an independent HTTP POST |
| Vercel serverless fit | Poor — pool is created per function invocation, connection limits hit quickly | Perfect — no connection state, no pool exhaustion |
| Neon compute wake-up | Adds to handshake time | Neon's HTTP proxy handles wake-up more efficiently |

**Current driver code** (`src/lib/db/client.ts`):

```ts
import { neon } from '@neondatabase/serverless';
import { env } from '@/lib/env';

const sql = neon(env.DATABASE_URL);

export async function query<T>(text: string, params?: unknown[]) {
  const rows = await sql.query(text, params as unknown[]) as T[];
  return { rows };
}

export const pool = {
  query: async <T>(text: string, params?: unknown[]) => {
    const rows = await sql.query(text, params as unknown[]) as T[];
    return { rows };
  },
};
```

Key details:

- `sql.query(text, params)` is the **parameterised** query method. It accepts `(string, unknown[])` like `pg.Pool.query()`.
- The tagged template form (`sql`SELECT ...``) is also available but not used here because existing query modules already pass SQL strings with `$1` placeholders.
- The `pool` export is a backward-compatibility shim so call sites like `pool.query<T>(...)` continue working without migration.

**Why no ORM:**

- The app has 9 tables with straightforward relational queries. An ORM would add bundle size and abstraction layers without meaningful benefit.
- Raw SQL with `$1`-style parameterised queries prevents SQL injection while keeping queries readable and auditable.
- Schema changes are managed by a single idempotent DDL script — simpler than Prisma migrations for a project of this size.

**Database schema** (9 tables):

| Table | Rows | Purpose |
|---|---|---|
| `processes` | 8 | Supply chain stages (self-referencing `next_process` FK) |
| `category` | 25 | Item categories with prominence tiers per process |
| `businesses` | 32 | External partner organisations |
| `warehouse` | 34 | Storage facilities (generated `capacity_pct` column) |
| `object` | 489 | Inventory items with full lineage tracking |
| `timeline` | — | Arrival/departure timestamps |
| `activity_log` | 20+ | Event audit trail |
| `users` | 4 | Role-based accounts (SA, SCA, SC, WO) |
| `object_relationships` | — | Many-to-many object linkages |

---

## 5. Authentication & Security

### `jose` `6.2.2` — JWT Signing & Verification

| Aspect | Detail |
|---|---|
| Algorithm | HS256 (HMAC-SHA256) |
| Access token | 15-minute expiry, signed with `JWT_SECRET` |
| Refresh token | 7-day expiry, signed with `JWT_REFRESH_SECRET` |
| MFA token | 5-minute expiry, signed with `JWT_SECRET` |
| Runtime | Works in **Node.js, Edge Runtime, and browser** |

**Why `jose` over `jsonwebtoken`:**

- **Edge compatible** — `jsonwebtoken` uses Node.js `crypto` module, which is **not available** in Vercel Edge Runtime. `jose` uses the Web Crypto API, so it works everywhere (Edge middleware, serverless functions, client-side).
- **Zero dependencies** — `jose` has no transitive dependencies, reducing supply-chain attack surface.
- **ESM-native** — proper `exports` map, works with `"type": "module"` without import hacks.
- **Active maintenance** — authored by Filip Skokan (OIDF member), frequently updated for security patches.

**Token flow:**

```
Login → [password verified] → signAccessToken + signRefreshToken → set HttpOnly cookies
  ↓ (if MFA enabled)
Login → signMfaToken → client submits TOTP code → /api/auth/mfa verifies → issue full tokens
```

---

### `@node-rs/bcrypt` `1.10.4` — Password Hashing

| Aspect | Detail |
|---|---|
| Implementation | **Rust-compiled** bcrypt via N-API |
| Cost factor | 12 rounds |
| Async | Yes — non-blocking, does not starve the event loop |

**Why `@node-rs/bcrypt` over `bcryptjs`:**

- **~5× faster** — Rust-compiled native addon vs. pure JS. On serverless where you pay per millisecond, this matters.
- **Non-blocking** — the Rust implementation runs outside the Node.js event loop via N-API worker threads. `bcryptjs` blocks the event loop during hashing.
- **Same API** — `hash(plain, rounds)` and `compare(plain, hash)`. Drop-in replacement.
- **Prebuilt binaries** — ships precompiled for Linux x64/ARM64 (Vercel), macOS, and Windows. No `node-gyp` build step.

---

### `otplib` `12.0.1` — TOTP Multi-Factor Authentication

| Aspect | Detail |
|---|---|
| Protocol | TOTP (RFC 6238) — time-based one-time passwords |
| Usage | `authenticator.verify({ token, secret })` |
| Storage | MFA secret stored in `users.mfa_secret` column |

**Why TOTP:**

- **Offline capable** — user generates codes on their device (Google Authenticator, Authy), no SMS dependency.
- **Industry standard** — RFC 6238, supported by all major authenticator apps.
- **Low infrastructure cost** — no SMS gateway fees, no email delivery concerns.

---

### Cookie-Based Session (`src/lib/auth/cookies.ts`)

| Cookie | HttpOnly | Secure (prod) | SameSite | MaxAge |
|---|---|---|---|---|
| `entity-token` | Yes | Yes | Lax | 15 min |
| `entity-refresh` | Yes | Yes | Lax | 7 days |
| `entity-role` | **No** | Yes | Lax | 7 days |

**Why cookies over `localStorage`:**

- **HttpOnly cookies** are inaccessible to JavaScript, preventing XSS token theft.
- **Automatic sending** — cookies are sent with every same-origin request, no manual `Authorization` header management.
- **Edge middleware access** — the `proxy.ts` middleware can read cookies directly from the request, enabling auth checks at the CDN edge.
- **`entity-role`** is intentionally non-HttpOnly so the client-side `Sidebar` component can read the user's role synchronously to conditionally render navigation items without an API call.

---

### Edge Middleware (`src/proxy.ts`)

| Aspect | Detail |
|---|---|
| Runtime | Vercel Edge Runtime (V8 isolate, not Node.js) |
| Purpose | Auth gating + role-based access control |
| Works with | `jose` for JWT verification (Edge-compatible) |

**Role-based access matrix:**

| Role | Pages | API Routes |
|---|---|---|
| SA (System Admin) | All pages | All API routes (`/api/`) |
| SCA (Supply Chain Analyst) | `/supply-chain-dashboard` | `/api/scd-data`, `/api/warehouses`, `/api/objects`, etc. |
| SC (Supply Commander) | `/decision-making`, `/inventory` | `/api/dmp-data`, `/api/warehousing-data`, `/api/businesses`, etc. |
| WO (Warehouse Operator) | `/inventory` | `/api/warehousing-data`, `/api/warehouses`, `/api/objects`, etc. |

**Why Edge middleware for auth:**

- **Zero cold start** — Edge functions start in <5ms globally, compared to 200-500ms for a Node.js serverless function cold start.
- **Fail-fast** — unauthenticated/unauthorised requests are rejected before reaching the API route, saving compute cost.
- **Global distribution** — runs at the nearest Vercel edge node to the user.

---

## 6. HTTP Client

### `axios` `1.14.0`

| Aspect | Detail |
|---|---|
| Role | Client-side HTTP requests to API routes |
| Interceptor | Automatic 401 → refresh token → retry flow |
| Deduplication | Concurrent refresh requests are coalesced into one promise |

**Why `axios` over `fetch`:**

- **Interceptors** — the refresh-token retry logic is implemented as a response interceptor. With `fetch`, this would require a custom wrapper function.
- **Automatic JSON** — `axios` parses response JSON and provides typed `res.data`.
- **Error semantics** — `axios` throws on non-2xx responses, making error handling in `try/catch` cleaner.
- **Request cancellation** — `AbortController` support built in.

**Refresh interceptor flow:**

```
Request → 401 response
  → Set _retry flag to prevent infinite loops
  → POST /api/auth/refresh
  → If success: retry original request with new cookie
  → If failure: redirect to /login?from=<current_path>
  → Concurrent 401s share the same refresh promise (deduplication)
```

---

## 7. Visualisation

### `maplibre-gl` `5.21.1` — Map Rendering

| Aspect | Detail |
|---|---|
| Role | Interactive map on the Decision Making Portal |
| Tile source | MapTiler Dark tiles (`NEXT_PUBLIC_MAPTILER_KEY`) |
| CSS | Imported globally via `@import "maplibre-gl/dist/maplibre-gl.css"` in `globals.css` |

**Why `maplibre-gl` over Google Maps / Mapbox:**

- **Open source** — BSD-3 license, no vendor lock-in. Mapbox GL JS v2+ is proprietary.
- **No per-load pricing** — MapTiler free tier is generous. Google Maps charges per map load.
- **WebGL-native** — hardware-accelerated vector tile rendering with smooth zoom/pan.
- **React-friendly** — can be controlled via refs and `useEffect` without a wrapper library (the project uses raw `maplibre-gl` directly).

---

### `recharts` `3.8.1` — Charting

| Aspect | Detail |
|---|---|
| Role | Bar charts, line charts in `WarehouseInspector` and dashboard components |
| Rendering | SVG-based |
| React integration | Declarative `<BarChart>`, `<LineChart>` components |

**Why `recharts`:**

- **React-native** — components are React elements, work naturally with state and props. No imperative API.
- **Lightweight** — smaller bundle than D3-based alternatives like Victory or Nivo.
- **Responsive** — built-in `<ResponsiveContainer>` adapts to parent dimensions.
- **Accessible** — SVG rendering is screen-reader-friendly and supports ARIA attributes.

---

## 8. Validation

### `zod` `3.24.2`

| Aspect | Detail |
|---|---|
| Role | Runtime schema validation for API request bodies |
| Used in | `/api/auth/login`, `/api/auth/mfa`, `/api/objects` |
| Pattern | Parse-then-use: `schema.safeParse(body)` → typed result |

**Why `zod`:**

- **TypeScript-first** — schema definitions automatically infer TypeScript types. No duplication between runtime validation and compile-time types.
- **Composable** — schemas can be combined (`z.object().merge()`, `.extend()`, `.pick()`).
- **Descriptive errors** — `safeParse` returns structured error objects with field-level messages, which the API routes return to the client.
- **Zero dependencies** — no transitive dependencies, minimal bundle impact.
- **Standard in Next.js ecosystem** — Server Actions, tRPC, and most Next.js tutorials use zod.

**Example usage:**

```ts
const MfaSchema = z.object({
  mfa_token: z.string().min(1, 'mfa_token is required'),
  code: z.string().min(6, 'code must be at least 6 digits'),
});

const parsed = MfaSchema.safeParse(rawBody);
if (!parsed.success) {
  return NextResponse.json(
    { error: 'Validation failed', details: parsed.error.flatten() },
    { status: 400 },
  );
}
```

---

## 9. Theme Management

### `next-themes` `0.4.6`

| Aspect | Detail |
|---|---|
| Role | Dark/light mode support |
| Current usage | Dark-only (`class="dark"` on `<html>`) |
| Integration | `<ThemeProvider>` in root layout |

**Why `next-themes`:**

- **SSR-safe** — prevents the "flash of incorrect theme" (FOIT) by injecting a blocking script that sets the `class` attribute before React hydrates.
- **Cookie/localStorage sync** — persists user's theme preference across sessions.
- **Minimal** — ~1KB gzipped. Does one thing well.
- **Tailwind compatible** — works with Tailwind's `dark:` variant via class strategy.

---

## 10. Linting & Code Quality

### ESLint `9.x` with `eslint-config-next` `16.2.2`

| Aspect | Detail |
|---|---|
| Config format | **Flat config** (`eslint.config.mjs`) — ESLint 9's new format |
| Presets | `core-web-vitals` + `typescript` |
| Run command | `npm run lint` → `eslint` |

**Configuration:**

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([...]),
]);
```

**Why these presets:**

- **`core-web-vitals`** — enforces rules that affect Lighthouse scores: proper `<Image>` usage, no sync scripts, accessible `<a>` tags, etc.
- **`typescript`** — enables `@typescript-eslint` rules for type-aware linting (no unused vars, no explicit `any`, etc.).
- **Flat config** — ESLint 9's new format is faster to resolve than `.eslintrc` cascade and supports ESM-only projects.

---

## 11. Build & Dev Tooling

### Turbopack (built into Next.js 16)

| Aspect | Detail |
|---|---|
| Role | Development bundler (replaces Webpack in dev mode) |
| Production | Next.js 16 production builds also use Turbopack |
| Config | `turbopack.root` in `next.config.ts` |

**Why Turbopack:**

- **Incremental HMR** — only re-bundles changed modules. Sub-50ms hot reload in development.
- **Rust-native** — faster than Webpack for large module graphs.
- **Default in Next.js 16** — no opt-in required, but the config sets `root` for correct path resolution.

---

### `tsx` `4.19.2`

| Aspect | Detail |
|---|---|
| Role | Run TypeScript files directly without compilation (scripts only) |
| Used for | `npm run seed` → `tsx scripts/seed.ts` |

**Why `tsx`:**

- **Zero config** — runs `.ts` files directly using esbuild under the hood. No `tsconfig` compilation step needed.
- **ESM support** — works with `"type": "module"` in `package.json`.
- **Fast** — esbuild transpiles TypeScript in milliseconds.
- **Dev-only** — listed in `devDependencies`, not shipped to production.

---

### `dotenv` `16.4.7`

| Aspect | Detail |
|---|---|
| Role | Loads `.env.local` variables for scripts that run outside of Next.js |
| Used by | `scripts/seed.ts`, `scripts/create-schema.ts` |

**Why it's needed:**

- Next.js automatically loads `.env.local` for its own runtime, but standalone scripts (`tsx scripts/seed.ts`) run outside Next.js and need `dotenv` to access environment variables.

---

## 12. Deployment & Caching

### Vercel (Serverless)

| Aspect | Detail |
|---|---|
| Platform | Vercel serverless functions + Edge network |
| API routes | Each route handler deploys as an independent serverless function |
| Middleware | `proxy.ts` runs on Edge Runtime (V8 isolates) |
| Static assets | Served from Vercel's CDN with immutable caching |

**Performance optimisations implemented:**

#### 1. Neon HTTP driver (zero connection overhead)
Every query is a single HTTPS `POST` to Neon's SQL proxy. No TCP connection, no TLS handshake, no WebSocket upgrade. Eliminates the 150-300ms cold-start penalty of connection-pooled drivers.

#### 2. Combined API endpoints (reduced serverless invocations)
Instead of 4 separate API calls per page load (each triggering a potentially cold serverless function), the app uses combined endpoints:

| Endpoint | Queries combined | Used by |
|---|---|---|
| `/api/scd-data` | processes + activity + warehouses + dashboard | Supply Chain Dashboard |
| `/api/dmp-data` | warehouses + businesses | Decision Making Portal |
| `/api/warehousing-data` | warehouses + processes | Inventory/Warehousing |

Each endpoint runs its queries in `Promise.all()` for parallel execution within a single function invocation.

#### 3. Edge caching (`Cache-Control` headers)

```ts
headers: {
  'Cache-Control': 's-maxage=10, stale-while-revalidate=59',
}
```

- **`s-maxage=10`** — Vercel's edge network caches the response for 10 seconds. Identical requests within this window are served from cache with zero backend latency.
- **`stale-while-revalidate=59`** — for the next 59 seconds after the 10s window, the edge serves the stale cached response immediately while revalidating in the background. The user always gets an instant response.

**Net effect:** First request after cache expiry takes ~100-200ms (Neon HTTP query). All subsequent requests within the SWR window are served in <10ms from the edge.

---

## 13. Environment & Configuration

### Required Environment Variables

| Variable | Purpose | Used by |
|---|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string | `src/lib/db/client.ts` |
| `JWT_SECRET` | HMAC key for access + MFA tokens | `src/lib/auth/jwt.ts` |
| `JWT_REFRESH_SECRET` | HMAC key for refresh tokens | `src/lib/auth/jwt.ts` |
| `ENCRYPTION_SECRET` | General-purpose encryption key | Reserved |
| `NEXT_PUBLIC_MAPTILER_KEY` | MapTiler API key for map tiles | `src/components/DmpMap.tsx` |

**Validation** (`src/lib/env.ts`):

At startup, `env.ts` validates that `DATABASE_URL`, `JWT_SECRET`, and `JWT_REFRESH_SECRET` are present. Missing variables produce a descriptive error message listing exactly which ones are absent.

---

## 14. Architecture Decisions

### Why App Router over Pages Router

- **Nested layouts** — shared UI (sidebar, header) is defined once in `layout.tsx` and inherited by child routes.
- **Server Components** — even though the current pages are all `'use client'`, the layout shell can be a Server Component, reducing client JS.
- **Route Handlers** — `route.ts` files replace the older `pages/api/` convention with better TypeScript support and streaming capabilities.
- **Edge middleware** — first-class support via `middleware.ts` (or `proxy.ts` in this project).

### Why raw SQL over Prisma/Drizzle

- **9 tables** — the schema is small enough that an ORM's code generation, migration system, and query builder add complexity without proportional benefit.
- **Full SQL control** — complex queries (self-referencing `next_process`, generated `capacity_pct` column, circular FKs) are expressed more naturally in raw SQL.
- **Smaller bundle** — Prisma Client adds ~1MB to the serverless function bundle. Raw SQL adds nothing.
- **Parameterised queries** — `$1` placeholders prevent SQL injection with the same safety guarantees as an ORM.

### Why `'use client'` pages with API routes (not Server Components + Server Actions)

- **Clear separation** — API routes serve as a documented, testable HTTP contract. The client is a standard SPA that fetches data via `axios`.
- **Caching strategy** — API route responses can be cached at the Vercel edge via `Cache-Control` headers. Server Component data fetching caches differently and requires ISR/PPR configuration.
- **Auth interceptor** — the axios interceptor handles token refresh transparently. Server Components would need a different pattern for auth token management.

---

## 15. Dependency Audit & Cleanup

### Active dependencies (production)

| Package | Version | Status |
|---|---|---|
| `@neondatabase/serverless` | ^1.0.2 | **Active** — core database driver |
| `@node-rs/bcrypt` | ^1.10.4 | **Active** — password hashing |
| `axios` | ^1.14.0 | **Active** — HTTP client with interceptors |
| `jose` | ^6.2.2 | **Active** — JWT signing/verification |
| `maplibre-gl` | ^5.21.1 | **Active** — map rendering |
| `next` | 16.2.2 | **Active** — framework |
| `next-themes` | ^0.4.6 | **Active** — theme provider |
| `otplib` | ^12.0.1 | **Active** — MFA TOTP |
| `react` | 19.2.3 | **Active** — UI library |
| `react-dom` | 19.2.3 | **Active** — React DOM renderer |
| `recharts` | ^3.8.1 | **Active** — charts |
| `zod` | ^3.24.2 | **Active** — validation |
| `pg` | ^8.13.3 | **Dev-only** — used by `scripts/seed.ts` only, moved to `devDependencies` |

### Dev dependencies

| Package | Version | Status |
|---|---|---|
| `@tailwindcss/postcss` | ^4 | **Active** — Tailwind CSS integration |
| `@types/node` | ^20 | **Active** — Node.js types |
| `@types/react` | ^19 | **Active** — React types |
| `@types/react-dom` | ^19 | **Active** — React DOM types |
| `dotenv` | ^16.4.7 | **Active** — script-only env loading |
| `eslint` | ^9 | **Active** — linter |
| `eslint-config-next` | 16.2.2 | **Active** — Next.js lint rules |
| `pg` | ^8.13.3 | **Active** — used by seed script only |
| `tailwindcss` | ^4 | **Active** — CSS framework |
| `tsx` | ^4.19.2 | **Active** — script runner |
| `typescript` | ^5 | **Active** — compiler |

### Recommended cleanup

All cleanup items from the initial audit have been completed:
- ✅ `pg` moved to `devDependencies` (not bundled into serverless functions)
- ✅ `prisma` removed (was installed experimentally, never used)
- ✅ `@types/pg` removed (no longer needed in `src/`)
- ✅ `prisma/schema.prisma` deleted
- ✅ Next.js upgraded to 16.2.2 (patches 4 CVEs including CSRF bypass)
- ✅ All auth endpoints use `Cache-Control: no-store` via `apiNoCache()`
- ✅ Login route uses explicit column list instead of `SELECT *`
- ✅ Rate limiter purges stale entries to prevent memory growth

---

*Last updated: auto-generated from codebase analysis.*
