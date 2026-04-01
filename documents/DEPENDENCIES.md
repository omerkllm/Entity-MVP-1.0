# Entity MVP — Dependencies & Tech Stack

> Every dependency organised by layer. Versions match `package.json` as of 2 Apr 2026.

---

## Frontend

| Package | Version | Purpose |
|---|---|---|
| `react` | 19.2.3 | UI rendering library |
| `react-dom` | 19.2.3 | React DOM renderer |
| `next` | 16.2.2 | Full-stack React framework (App Router, API Routes, Edge Middleware) |
| `next-themes` | ^0.4.6 | Dark/light mode with SSR-safe hydration |
| `axios` | ^1.14.0 | HTTP client with auto-refresh interceptor (401 → retry) |
| `recharts` | ^3.8.1 | SVG charts (bar, line) in dashboard & inspector components |
| `tailwindcss` | ^4 | Utility-first CSS framework (Oxide engine, CSS-first config) |
| `@tailwindcss/postcss` | ^4 | PostCSS plugin for Tailwind 4 |

---

## Mapping & Geospatial

| Package | Version | Purpose |
|---|---|---|
| `maplibre-gl` | ^5.21.1 | WebGL vector-tile map (Decision Making Portal) |
| — | — | Tile source: **MapTiler Dark** via `NEXT_PUBLIC_MAPTILER_KEY` |

---

## Backend (API Routes & Middleware)

| Package | Version | Purpose |
|---|---|---|
| `next` | 16.2.2 | Route Handlers (`src/app/api/`) run as Vercel serverless functions |
| `zod` | ^3.24.2 | Runtime schema validation for request bodies |

---

## Database

| Package | Version | Purpose |
|---|---|---|
| `@neondatabase/serverless` | ^1.0.2 | Neon HTTP query driver — stateless, zero-connection-overhead |
| `pg` | ^8.13.3 | Node-postgres (dev-only — used by `scripts/seed.ts`) |

**Provider:** Neon PostgreSQL (serverless, `ap-southeast-1`)
**ORM:** None — raw parameterised SQL (`$1` placeholders)
**Schema:** Idempotent DDL script (`scripts/create-schema.ts`)

---

## Authentication & Security

| Package | Version | Purpose |
|---|---|---|
| `jose` | ^6.2.2 | JWT sign/verify (HS256) — Edge Runtime compatible |
| `@node-rs/bcrypt` | ^1.10.4 | Rust-native bcrypt password hashing (12 rounds) |
| `otplib` | ^12.0.1 | TOTP multi-factor authentication (RFC 6238) |

**Session:** HttpOnly cookies (`entity-token`, `entity-refresh`, `entity-role`)
**Middleware:** `src/proxy.ts` — Edge Runtime auth gating + role-based access control

---

## Build & Dev Tooling

| Package | Version | Purpose |
|---|---|---|
| `typescript` | ^5 | Language compiler (strict mode, ES2020 target) |
| `tsx` | ^4.19.2 | Run TypeScript scripts directly (esbuild-powered) |
| `dotenv` | ^16.4.7 | Load `.env.local` for standalone scripts |
| `eslint` | ^9 | Linter (flat config) |
| `eslint-config-next` | 16.2.2 | Next.js rules: core-web-vitals + TypeScript |

**Bundler:** Turbopack (built into Next.js 16)

---

## Type Definitions (dev)

| Package | Version | Purpose |
|---|---|---|
| `@types/node` | ^20 | Node.js API types |
| `@types/react` | ^19 | React types |
| `@types/react-dom` | ^19 | React DOM types |

---

## Deployment

| Service | Role |
|---|---|
| **Vercel** | Hosting — serverless functions + Edge network + CDN |
| **Neon** | Managed PostgreSQL (serverless, auto-suspend) |
| **MapTiler** | Vector map tiles (free tier) |

---

## Caching Strategy

| Layer | Header | Effect |
|---|---|---|
| Data API routes | `s-maxage=10, stale-while-revalidate=59` | Vercel edge caches for 10s, serves stale for 59s while revalidating |
| Auth API routes | `no-store` | Never cached — login, logout, refresh, session, MFA |

---

## Environment Variables

| Variable | Required | Scope |
|---|---|---|
| `DATABASE_URL` | Yes | Server |
| `JWT_SECRET` | Yes | Server |
| `JWT_REFRESH_SECRET` | Yes | Server |
| `ENCRYPTION_SECRET` | Yes | Server |
| `NEXT_PUBLIC_MAPTILER_KEY` | Yes | Client + Server |
