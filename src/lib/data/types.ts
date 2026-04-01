// ─── Supply Chain Node ──────────────────────────────────────────────
export type SupplyChainNode = {
  id: string
  name: string
  status: 'Active' | 'Pending'
  quantity: number
  unit: string
  lastUpdated: string
}

// ─── Object (Inventory Item) ────────────────────────────────────────
export type RawObject = {
  objectId: string
  quantity: number
  unit: string
  transitStatus: string
  objectHealth: string
  arrivalTime: string
}

export type ObjectRelationship = {
  objectId: string
  warehouseId: string
  objectCategory: string
}

export type ObjectRecord = RawObject & {
  objectCategory: string
  warehouseId: string
}

// ─── Category ───────────────────────────────────────────────────────
export type Category = {
  categoryId: string
  name: string
  processId: string
}

// ─── Warehouse ──────────────────────────────────────────────────────
export type WarehouseObject = {
  name: string
  quantity: string
  occupiedCapacity: number
  trend: 'up' | 'down' | 'none'
}

export type ChartBar = {
  hasBg: boolean
  lightH: number
  lightMt: number
  medH: number
  medMt: number
  darkH: number
  darkMt: number
}

export type RawWarehouse = {
  id: string
  warehouseId: string
  title: string
  usedCapacity: number
  totalCapacity: number
  region: string
  status: string
  coordinates: string
  hours: string
  warehouseName: string
  address: string
  objects: WarehouseObject[]
  chartBars: ChartBar[]
  chartLabels: string[]
}

export type WarehouseRelationship = {
  warehouseId: string
  objectCategory: string
  businessLinkType: string | null
  processId: string
}

export type Warehouse = Omit<RawWarehouse, 'usedCapacity'> & {
  objectCategory: string
  businessLinkType: string | null
  processId: string
  usedCapacity: number  // computed from sum of object quantities, overrides raw JSON value
}

// ─── DB-backed Warehouse (postgres, no JSON display fields) ─────────
export type DBWarehouse = {
  warehouseId: string
  id: string            // same as warehouseId — kept for React key compat
  title: string
  region: string
  coordinates: string
  objectCategory: string
  hours: string
  status: string
  totalCapacity: number
  usedCapacity: number   // SUM of all object quantities for this warehouse (computed in DB)
  transitQty: number     // SUM of in-transit object quantities for this warehouse (computed in DB)
  businessLinkType: string | null
  processId: string
  warehouseName: string
  address: string
}

// ─── DB-backed Business (postgres) ──────────────────────────────────
export type DBBusiness = {
  businessId: string
  objectCategory: string
  region: string
  coordinates: string
  linkedWarehouseIds: string[]
  linkType: 'Supplier' | 'Customer' | null
}

// ─── Auth (User rows from `users` table) ────────────────────────────
export type UserRow = {
  user_id: string
  email: string
  username: string
  password_hash: string
  role: string
  is_active: boolean
  failed_attempts: number
  locked_until: Date | null
  mfa_secret: string | null
}

/** Subset of UserRow returned by the MFA verification query. */
export type MfaUserRow = Pick<UserRow, 'user_id' | 'email' | 'role' | 'is_active' | 'mfa_secret'>

// ─── Activity Log ───────────────────────────────────────────────────
export type ActivityLogEntry = {
  nodeId: string
  eventType: string
  time: string
}

// ─── DMP Filters ────────────────────────────────────────────────────
export type FilterItem = {
  key: string
  label: string
  count: number
  color?: string
}

export type FilterSection = {
  id: string
  title: string
  filters: FilterItem[]
}

// ─── AI Agent ───────────────────────────────────────────────────────
export type AgentOption = {
  id: string
  title: string
  color: string
  points: string[]
}

export type AgentMessage = {
  role: 'user' | 'agent'
  label: string
  content?: string
  summary?: string
  branch?: { name: string; type: string }
  options?: AgentOption[]
  progress?: number
}

export type AgentConversation = {
  id: string
  messages: AgentMessage[]
}

export type AIAgentConfig = {
  agentName: string
  agentTarget: string
  greeting: string
  inputPlaceholder: string
  conversations: AgentConversation[]
}

// ─── Dashboard ──────────────────────────────────────────────────────
export type DashboardStats = {
  disruptionCount: number
  avgHealth: number
  warehouseCount: number
  nodeCount: number
}
