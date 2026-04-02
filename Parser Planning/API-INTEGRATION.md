# API Integration

## Overview

The Parser Agent requires 3 new API routes and modifications to the existing frontend `AIChatPanel` component. All routes live under `/api/agent/` and follow the existing project patterns (Next.js App Router, JWT auth, Zod validation, standard JSON responses).

---

## New API Routes

### `POST /api/agent/chat`

The primary endpoint. Accepts any message (with or without commands), routes to the orchestrator, and returns the agent's response.

**File:** `src/app/api/agent/chat/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth/session';
import { orchestrate } from '@/lib/agent/orchestrator';
import { z } from 'zod';

const ChatRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  sessionId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  // 1. Auth
  const session = await verifySession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Validate
  const body = await req.json();
  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // 3. Role check — only SA and SC can use the agent
  if (!['SA', 'SC'].includes(session.role)) {
    return NextResponse.json({ error: 'Insufficient role' }, { status: 403 });
  }

  // 4. Orchestrate
  const result = await orchestrate({
    message: parsed.data.message,
    sessionId: parsed.data.sessionId,
    userId: session.userId,
    role: session.role,
  });

  return NextResponse.json(result);
}
```

**Request:**
```json
{
  "message": "I need 30 units of Raw Cotton in 4 days from Punjab suppliers @simul",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (simulation):**
```json
{
  "messages": [
    {
      "role": "agent",
      "label": "Parse Agent",
      "content": "I've analysed the Raw Cotton supply landscape in Punjab...",
      "summary": "3 procurement options generated based on proximity and reliability.",
      "branch": "procurement-sim-f3a2bc",
      "options": [
        {
          "id": "opt-a",
          "title": "Optimal: 2 Punjab suppliers",
          "color": "green",
          "points": [
            "Source from Sindh Cotton Mills (32km) and Lahore Fibres (18km)",
            "Estimated delivery: 2-3 days",
            "Reliability score: 92/100"
          ]
        },
        {
          "id": "opt-b",
          "title": "Moderate: Punjab + Sindh mix",
          "color": "yellow",
          "points": [
            "Source from Lahore Fibres (18km) and Karachi Cotton (580km)",
            "Estimated delivery: 3-4 days",
            "Reliability score: 78/100"
          ]
        },
        {
          "id": "opt-c",
          "title": "Risky: Spot market",
          "color": "red",
          "points": [
            "Open bid to 5 unvetted suppliers",
            "Estimated delivery: 1-4 days (variable)",
            "Reliability score: 45/100"
          ]
        }
      ]
    }
  ],
  "simulation": {
    "id": "f3a2bc",
    "options": ["opt-a", "opt-b", "opt-c"],
    "expiresAt": "2025-01-15T15:30:00Z"
  }
}
```

**Response (free-text query):**
```json
{
  "messages": [
    {
      "role": "agent",
      "label": "Parse Agent",
      "content": "Warehouse WH-0003 (Lahore Central) is at 72% capacity — 360/500 units used. The primary stock is Raw Cotton (280 units) and Processed Silk (80 units)."
    }
  ]
}
```

---

### `POST /api/agent/proceed`

Dedicated endpoint for committing a simulation option. Separated from `/chat` for clearer intent and easier middleware guarding.

**File:** `src/app/api/agent/proceed/route.ts`

```typescript
const ProceedRequestSchema = z.object({
  sessionId: z.string().uuid(),
  simulationId: z.string().min(1).max(12),
  optionId: z.enum(['opt-a', 'opt-b', 'opt-c']),
});
```

**Request:**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "simulationId": "f3a2bc",
  "optionId": "opt-a"
}
```

**Response:**
```json
{
  "messages": [
    {
      "role": "agent",
      "label": "Parse Agent",
      "content": "Option A committed successfully. 30 units of Raw Cotton are now in transit to WH-0003 (Lahore Central).",
      "progress": {
        "object": 2,
        "warehouse": 1,
        "activity_log": 1
      }
    }
  ],
  "committed": {
    "optionId": "opt-a",
    "summary": "Procurement from 2 Punjab suppliers committed",
    "affectedRows": {
      "object": 2,
      "warehouse": 1,
      "activity_log": 1
    }
  }
}
```

---

### `POST /api/agent/cancel`

Cancels the active simulation and drops all views.

**File:** `src/app/api/agent/cancel/route.ts`

```typescript
const CancelRequestSchema = z.object({
  sessionId: z.string().uuid(),
  simulationId: z.string().min(1).max(12),
});
```

**Response:**
```json
{
  "messages": [
    {
      "role": "agent",
      "label": "Parse Agent",
      "content": "Simulation cancelled. All preview data has been discarded."
    }
  ]
}
```

---

## Middleware Updates

### `src/proxy.ts` — Route Access

Add agent routes to the role-access maps:

```typescript
const ROLE_API_ACCESS: Record<string, string[]> = {
  SA: ['/api/agent/chat', '/api/agent/proceed', '/api/agent/cancel', ...existing],
  SC: ['/api/agent/chat', '/api/agent/proceed', '/api/agent/cancel', ...existing],
  SCA: [],  // No agent access
  WO: [],   // No agent access
};
```

---

## Frontend Integration

### Updated `AIChatPanel.tsx`

Key changes needed:

```typescript
// 1. Add session ID state
const [sessionId] = useState(() => crypto.randomUUID());

// 2. Add message send handler
const sendMessage = async (input: string) => {
  // Add user message to state
  setMessages(prev => [...prev, { role: 'user', label: 'You', content: input }]);

  const res = await axios.post('/api/agent/chat', {
    message: input,
    sessionId,
  });

  const data: AgentChatResponse = res.data;

  // Add agent messages to state
  setMessages(prev => [...prev, ...data.messages]);

  // Track active simulation
  if (data.simulation) {
    setActiveSimulation(data.simulation);
  }
  if (data.committed) {
    setActiveSimulation(null);
  }
};

// 3. Add option click handler (for @proceed)
const handleOptionSelect = async (optionId: string) => {
  if (!activeSimulation) return;

  const res = await axios.post('/api/agent/proceed', {
    sessionId,
    simulationId: activeSimulation.id,
    optionId,
  });

  const data: AgentChatResponse = res.data;
  setMessages(prev => [...prev, ...data.messages]);
  setActiveSimulation(null);
};

// 4. Add cancel handler
const handleCancel = async () => {
  if (!activeSimulation) return;

  await axios.post('/api/agent/cancel', {
    sessionId,
    simulationId: activeSimulation.id,
  });

  setMessages(prev => [...prev, {
    role: 'agent',
    label: 'Parse Agent',
    content: 'Simulation cancelled.',
  }]);
  setActiveSimulation(null);
};
```

### New Component: `SimulationCard.tsx`

Renders each option inside the chat:

```typescript
interface SimulationCardProps {
  option: AgentOption;
  onSelect: (optionId: string) => void;
  disabled: boolean;
}

function SimulationCard({ option, onSelect, disabled }: SimulationCardProps) {
  const borderColor = {
    green: 'border-green-500',
    yellow: 'border-yellow-500',
    red: 'border-red-500',
  }[option.color];

  return (
    <button
      onClick={() => onSelect(option.id)}
      disabled={disabled}
      className={`border-2 ${borderColor} rounded-lg p-4 text-left hover:bg-white/5 ...`}
    >
      <h4>{option.title}</h4>
      <ul>
        {option.points.map((p, i) => <li key={i}>{p}</li>)}
      </ul>
    </button>
  );
}
```

---

## Request / Response Type Definitions

Add to `src/lib/data/types.ts`:

```typescript
// --- Agent API types ---

export interface AgentChatRequest {
  message: string;
  sessionId: string;
}

export interface AgentProceedRequest {
  sessionId: string;
  simulationId: string;
  optionId: 'opt-a' | 'opt-b' | 'opt-c';
}

export interface AgentCancelRequest {
  sessionId: string;
  simulationId: string;
}

export interface AgentChatResponse {
  messages: AgentMessage[];
  simulation?: {
    id: string;
    options: string[];
    expiresAt: string;
  };
  committed?: {
    optionId: string;
    summary: string;
    affectedRows: Record<string, number>;
  };
}
```

---

## Error Handling

All agent API routes return errors in a consistent shape:

```typescript
interface AgentErrorResponse {
  error: string;
  code?: string;   // machine-readable code from COMMAND-SYSTEM.md error table
  details?: unknown;
}
```

**HTTP Status Mapping:**

| Scenario | Status | Code |
|---|---|---|
| Not authenticated | 401 | — |
| Wrong role (WO/SCA) | 403 | `INSUFFICIENT_ROLE` |
| Invalid request body | 400 | — |
| No active simulation for `@proceed`/`@cancel` | 409 | `NO_ACTIVE_SIMULATION` |
| Simulation expired | 410 | `SIMULATION_EXPIRED` |
| NLU can't understand input | 422 | `QUERY_GENERATION_FAILED` |
| DB transaction failed | 500 | `COMMIT_FAILED` |

---

## Rate Limiting

To prevent abuse of the SQL-generating agent:

| Limit | Value | Scope |
|---|---|---|
| Messages per minute | 20 | Per user session |
| Active simulations per user | 1 | Per user |
| `@simul` calls per hour | 10 | Per user |
| `@proceed` calls per hour | 10 | Per user |

Implementation: simple in-memory counter per `userId`, reset on window expiry. For production, move to Redis or Vercel KV.
