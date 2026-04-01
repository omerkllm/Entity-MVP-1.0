# Entity SC

Supply-chain management platform — Next.js 16 (App Router + Turbopack), React 19, TypeScript, Tailwind CSS 4, PostgreSQL.

---

## Quickstart

### 1. Backend — PostgreSQL

The app requires a running PostgreSQL instance. The Windows service is `postgresql-x64-18`.

**Start the database** (run PowerShell as Administrator):
```powershell
Start-Service postgresql-x64-18
```

**Check it's up:**
```powershell
Get-Service postgresql-x64-18
# Status should be "Running"
```

**Seed the database** (first-time setup or reset):
```powershell
cd entity
npm run seed
```

> Seed wipes all tables and re-inserts processes, categories, warehouses, objects, and the four user accounts.

**Connection string** (in `entity/.env.local`):
```
DATABASE_URL=postgresql://postgres:omer2005@localhost:5432/entity_sc
```

---

### 2. Frontend — Dev Server

All commands run from the `entity/` directory.

**Start:**
```powershell
cd entity
npm run dev
```

Opens at **http://localhost:3000**

**Stop:**

Press `Ctrl + C` in the terminal running `npm run dev`.

If the process is stuck or the terminal is closed:
```powershell
Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess) -Force
```

---

## Login Credentials

| Username | Password | Role | Landing Page |
|----------|----------|------|--------------|
| `admin` | `123` | SA — System Admin | /supply-chain-dashboard |
| `analyst` | `123` | SCA — Supply Chain Analyst | /supply-chain-dashboard |
| `commander` | `123` | SC — Strategic Commander | /decision-making |
| `operator` | `123` | WO — Warehouse Operator | /inventory/warehousing |

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the dev server with Turbopack |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run seed` | Wipe and re-seed the database |
| `npm run lint` | Run ESLint |
