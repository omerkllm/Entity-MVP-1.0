# Entity — Class Diagram Reference

All types, modules, functions, components, their attributes, and method descriptions — organized by file for design class diagram creation.

---

## 1. Types (`src/lib/data/types.ts`)

This file contains **all** shared TypeScript type definitions. No functions — only type exports.

### `SupplyChainNode`
| Attribute     | Type                    | Description                                |
|---------------|-------------------------|--------------------------------------------|
| id            | `string`                | Unique node identifier (e.g. `"OBJ-127"`) |
| name          | `string`                | Display name of the supply chain process   |
| status        | `'Active' \| 'Pending'` | Current operational status                 |
| quantity      | `number`                | Quantity associated with this node         |
| unit          | `string`                | Unit of measurement                        |
| lastUpdated   | `string`                | Timestamp of last update                   |

### `RawObject`
| Attribute     | Type     | Description                               |
|---------------|----------|-------------------------------------------|
| objectId      | `string` | Unique object identifier (e.g. `"OBJ-0001"`) |
| quantity      | `number` | Quantity of this object                    |
| unit          | `string` | Unit of measurement (e.g. `"kg"`, `"L"`)  |
| transitStatus | `string` | Current transit state (`"In Transit"`, `"Delivered"`, `"—"`) |
| objectHealth  | `string` | Health percentage as string (e.g. `"+42.5%"`) |
| arrivalTime   | `string` | Arrival timestamp                          |

### `ObjectRelationship`
| Attribute      | Type     | Description                                     |
|----------------|----------|-------------------------------------------------|
| objectId       | `string` | FK — links to `RawObject.objectId`              |
| warehouseId    | `string` | FK — links to `RawWarehouse.warehouseId`        |
| objectCategory | `string` | Category classification (e.g. `"Sulfuric Acid"`) |

### `ObjectRecord` (= `RawObject & { objectCategory, warehouseId }`)
Extends `RawObject` with two joined fields from `ObjectRelationship`:

| Additional Attribute | Type     | Description                            |
|----------------------|----------|----------------------------------------|
| objectCategory       | `string` | Category from relationship join        |
| warehouseId          | `string` | Warehouse ID from relationship join    |

### `WarehouseObject`
| Attribute        | Type                         | Description                              |
|------------------|------------------------------|------------------------------------------|
| name             | `string`                     | Object name displayed in warehouse       |
| quantity         | `string`                     | Quantity as display string               |
| occupiedCapacity | `number`                     | Capacity this object occupies            |
| trend            | `'up' \| 'down' \| 'none'`  | Capacity trend direction                 |

### `ChartBar`
| Attribute | Type      | Description                           |
|-----------|-----------|---------------------------------------|
| hasBg     | `boolean` | Whether bar has a background fill     |
| lightH    | `number`  | Height of light segment               |
| lightMt   | `number`  | Margin-top of light segment           |
| medH      | `number`  | Height of medium segment              |
| medMt     | `number`  | Margin-top of medium segment          |
| darkH     | `number`  | Height of dark segment                |
| darkMt    | `number`  | Margin-top of dark segment            |

### `RawWarehouse`
| Attribute    | Type               | Description                             |
|--------------|--------------------|-----------------------------------------|
| id           | `string`           | Short warehouse identifier (e.g. `"WH-01"`) |
| warehouseId  | `string`           | Unique key (e.g. `"NMP-100"`)           |
| title        | `string`           | Warehouse title                          |
| usedCapacity | `number`           | Raw used capacity from JSON (overridden on merge) |
| totalCapacity| `number`           | Maximum capacity                         |
| region       | `string`           | Geographic region                        |
| status       | `string`           | `"Open"` or `"Closed"`                  |
| coordinates  | `string`           | GPS coordinates string                   |
| hours        | `string`           | Operational hours                        |
| warehouseName| `string`           | Full display name                        |
| address      | `string`           | Street address                           |
| objects      | `WarehouseObject[]` | Embedded object summary list            |
| chartBars    | `ChartBar[]`       | Chart visualization data                 |
| chartLabels  | `string[]`         | Labels for chart X-axis                  |

### `WarehouseRelationship`
| Attribute       | Type     | Description                                      |
|-----------------|----------|--------------------------------------------------|
| warehouseId     | `string` | FK — links to `RawWarehouse.warehouseId`         |
| objectCategory  | `string` | Primary category for this warehouse              |
| businessLinkType| `string` | Type of business linkage                         |
| processId       | `string` | FK — links to `SupplyChainNode.id`               |

### `Warehouse` (= `Omit<RawWarehouse, 'usedCapacity'> & { ... }`)
Extends `RawWarehouse` (minus raw `usedCapacity`) with joined + computed fields:

| Additional Attribute | Type     | Description                                        |
|----------------------|----------|----------------------------------------------------|
| objectCategory       | `string` | From `WarehouseRelationship`                       |
| businessLinkType     | `string` | From `WarehouseRelationship`                       |
| processId            | `string` | From `WarehouseRelationship`                       |
| usedCapacity         | `number` | **Computed**: sum of all object quantities in warehouse |

### `ActivityLogEntry`
| Attribute | Type     | Description                       |
|-----------|----------|-----------------------------------|
| nodeId    | `string` | FK — links to `SupplyChainNode.id` |
| eventType | `string` | Type of event (e.g. `"shipment"`) |
| time      | `string` | Human-readable time string        |

### `FilterItem`
| Attribute | Type     | Description                          |
|-----------|----------|--------------------------------------|
| key       | `string` | Unique filter key                    |
| label     | `string` | Display label                        |
| count     | `number` | Number of matching items             |
| color     | `string?`| Optional colour for the filter swatch |

### `FilterSection`
| Attribute | Type           | Description                      |
|-----------|----------------|----------------------------------|
| id        | `string`       | Unique section identifier        |
| title     | `string`       | Section heading                  |
| filters   | `FilterItem[]` | Filters within this section      |

### `AgentOption`
| Attribute | Type       | Description                          |
|-----------|------------|--------------------------------------|
| id        | `string`   | Option identifier                    |
| title     | `string`   | Option heading                       |
| color     | `string`   | Accent colour for this option        |
| points    | `string[]` | Bullet-point detail items            |

### `AgentMessage`
| Attribute | Type                           | Description                      |
|-----------|--------------------------------|----------------------------------|
| role      | `'user' \| 'agent'`           | Who sent the message             |
| label     | `string`                       | Message label / tag              |
| content   | `string?`                      | User message body                |
| summary   | `string?`                      | Agent response summary           |
| branch    | `{ name, type }?`             | Optional branch reference        |
| options   | `AgentOption[]?`              | Agent response options           |
| progress  | `number?`                      | Progress bar value (0–1)         |

### `AgentConversation`
| Attribute | Type             | Description                 |
|-----------|------------------|-----------------------------|
| id        | `string`         | Conversation identifier     |
| messages  | `AgentMessage[]`  | Ordered list of messages    |

### `AIAgentConfig`
| Attribute        | Type                   | Description                      |
|------------------|------------------------|----------------------------------|
| agentName        | `string`               | Display name of AI agent         |
| agentTarget      | `string`               | Target identifier                |
| greeting         | `string`               | Initial greeting text            |
| inputPlaceholder | `string`               | Placeholder for chat input       |
| conversations    | `AgentConversation[]`  | List of conversations            |

---

## 2. Object Data Module (`src/lib/data/objects.ts`)

### Attributes (module-level)
| Name             | Type                               | Description                                                      |
|------------------|------------------------------------|------------------------------------------------------------------|
| relationshipMap  | `Map<string, ObjectRelationship>`  | Private lookup map: `objectId` → `ObjectRelationship` for O(1) joins |
| allObjects       | `ObjectRecord[]`                   | Exported merged array of all 489 objects with relationship data joined by key |

### Methods
| Method                   | Signature                                          | Description                                                                 |
|--------------------------|-----------------------------------------------------|-----------------------------------------------------------------------------|
| `getObjectsByWarehouseId`| `(warehouseId: string) => ObjectRecord[]`           | Returns all objects belonging to a specific warehouse, filtered by warehouseId |
| `computeUsedCapacity`    | `(warehouseId: string) => number`                   | Sums the `quantity` of every object in a warehouse; used to compute warehouse capacity |
| `parseHealthValue`       | `(health: string) => number`                        | Parses the health string (e.g. `"+42.5%"`) into a numeric float value       |
| `isHealthPositive`       | `(health: string) => boolean`                       | Returns `true` if the absolute health value is ≥ 30 (used for green/red styling) |

---

## 3. Warehouse Data Module (`src/lib/data/warehouses.ts`)

### Attributes (module-level)
| Name             | Type                                  | Description                                                            |
|------------------|---------------------------------------|------------------------------------------------------------------------|
| relationshipMap  | `Map<string, WarehouseRelationship>`  | Private lookup map: `warehouseId` → `WarehouseRelationship` for O(1) joins |
| allWarehouses    | `Warehouse[]`                         | Exported merged array of all 34 warehouses with computed `usedCapacity` |

### Methods
| Method                      | Signature                                          | Description                                                                   |
|-----------------------------|-----------------------------------------------------|-------------------------------------------------------------------------------|
| `getWarehousesByProcessId`  | `(processId: string) => Warehouse[]`               | Filters warehouses belonging to a specific supply chain node/process          |
| `getWarehouseByWarehouseId` | `(warehouseId: string) => Warehouse \| undefined`  | Finds a single warehouse by its unique warehouseId                            |
| `computeCapacityPercent`    | `(used: number, total: number) => number`          | Calculates `(used / total) * 100` rounded to 2 decimal places                |
| `isCapacityHealthy`         | `(pct: number) => boolean`                         | Returns `true` if capacity percentage ≥ 30 (healthy threshold for green/red)  |

---

## 4. Supply Chain Module (`src/lib/data/supply-chain.ts`)

### Attributes (module-level)
| Name             | Type                  | Description                                              |
|------------------|-----------------------|----------------------------------------------------------|
| supplyChainNodes | `SupplyChainNode[]`   | All 8 supply chain process nodes                         |
| activeNodes      | `SupplyChainNode[]`   | Subset where `status === 'Active'`                       |
| disruptedNodes   | `SupplyChainNode[]`   | Subset where `status !== 'Active'`                       |
| disruptionCount  | `number`              | Count of disrupted nodes                                 |
| activityLog      | `ActivityLogEntry[]`  | All activity log entries from JSON                       |

### Methods
| Method              | Signature                                      | Description                                                                          |
|---------------------|-------------------------------------------------|--------------------------------------------------------------------------------------|
| `getNodeById`       | `(id: string) => SupplyChainNode \| undefined` | Finds a supply chain node by its ID                                                  |
| `getNodeName`       | `(id: string) => string`                       | Returns the name of a node by ID, or empty string if not found                       |
| `getRecentActivity` | `() => { text: string; time: string }[]`       | Maps activity log entries to display format, resolving node names from IDs            |

---

## 5. Data Index (`src/lib/data/index.ts`)

Barrel re-export file. No types or functions of its own — re-exports everything from `objects.ts`, `warehouses.ts`, `supply-chain.ts`, and all types from `types.ts`.

---

## 6. Filter Utilities (`src/utils/filters.ts`)

### Methods
| Method                | Signature                                                                                                                                                    | Description                                                                                                     |
|-----------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------|
| `deriveFilterOptions` | `<T>(records: T[], key: keyof T, exclude?: string[]) => { value: string }[]`                                                                                | Extracts unique values from a record array for a given key; used to populate filter checkbox lists. Optionally excludes specific values (e.g. `"—"`) |
| `matchesFilterSet`    | `(value: string, activeSet: Set<string>) => boolean`                                                                                                         | Checks if a value passes a filter; returns `true` if the set is empty (no filter active) or the value is in the set |
| `computeToggleCount`  | `<T>(records: T[], allFilters: Record<string, Set<string>>, filterCategories: { key: string }[], targetKey: string, targetValue: string, rangeCheck?: (record: T) => boolean) => number` | Counts how many records would match if a specific filter value were toggled on/off. Creates a hypothetical filter state, toggles the target, and filters the full dataset to get the count. Used to show dynamic counts next to checkboxes |
| `toggleFilterValue`   | `(prev: Record<string, Set<string>>, key: string, value: string) => Record<string, Set<string>>`                                                           | Returns a new filter state with the specified value toggled (added if absent, removed if present) in the specified category |
| `clearAllFilters`     | `(prev: Record<string, Set<string>>) => Record<string, Set<string>>`                                                                                       | Returns a new filter state with all sets cleared (emptied)                                                       |
| `createEmptyFilters`  | `(categories: { key: string }[]) => Record<string, Set<string>>`                                                                                           | Creates an initial filter state object with an empty `Set<string>` for each category key                         |

---

## 7. Formatting Utilities (`src/utils/format.ts`)

### Methods
| Method                 | Signature                                          | Description                                                                        |
|------------------------|-----------------------------------------------------|------------------------------------------------------------------------------------|
| `padTwo`               | `(n: number) => string`                            | Pads a number to 2 digits with leading zero (e.g. `2` → `"02"`)                   |
| `formatWarehouseName`  | `(warehouseName: string, id: string) => string`    | Formats warehouse display name as `"Name { ID }"`, stripping any existing `{...}` suffix |

---

## 8. ErrorBoundary (`src/components/ui/ErrorBoundary.tsx`)

React **class component** that catches JavaScript errors in its child tree.

### Attributes (Props)
| Attribute | Type         | Description                               |
|-----------|--------------|-------------------------------------------|
| children  | `ReactNode`  | Child components to wrap                  |
| fallback  | `ReactNode?` | Optional custom fallback UI on error      |

### Attributes (State)
| Attribute | Type           | Description                        |
|-----------|----------------|------------------------------------|
| hasError  | `boolean`      | Whether an error has been caught   |
| error     | `Error \| null`| The caught error object            |

### Methods
| Method                     | Signature                                        | Description                                                                   |
|----------------------------|---------------------------------------------------|-------------------------------------------------------------------------------|
| `constructor`              | `(props: Props)`                                 | Initializes state with `hasError: false, error: null`                         |
| `getDerivedStateFromError` | `static (error: Error) => State`                 | React lifecycle: sets `hasError: true` when a child throws                    |
| `componentDidCatch`        | `(error: Error, info: ErrorInfo) => void`        | React lifecycle: logs error and component stack to console                    |
| `render`                   | `() => ReactNode`                                | Renders fallback UI (error message + "Try Again" button) or children          |

---

## 9. FilterPanel (`src/components/ui/FilterPanel.tsx`)

Contains three exported functional components for reusable filter UI.

### `CheckboxFilterSections` (function component)

Renders a list of filter categories, each with checkboxes, counts, and a "Show More/Less" toggle.

| Prop           | Type                                             | Description                                                  |
|----------------|--------------------------------------------------|--------------------------------------------------------------|
| categories     | `{ key: string; label: string }[]`               | Filter category definitions                                  |
| getOptions     | `(key: string) => { value: string }[]`           | Callback to derive available options for a category           |
| activeFilters  | `Record<string, Set<string>>`                    | Current active filter state                                  |
| expanded       | `Set<string>`                                    | Which categories are expanded past 3 items                   |
| setExpanded    | `Dispatch<SetStateAction<Set<string>>>`          | Setter for expanded state                                    |
| getCount       | `(catKey: string, optValue: string) => number`   | Callback returning dynamic count for a filter option         |
| onToggle       | `(key: string, value: string) => void`           | Callback fired when a checkbox is clicked                    |

### `RangeFilter` (function component)

Renders a labeled pair of Min/Max numeric inputs for range filtering.

| Prop        | Type                      | Description                         |
|-------------|---------------------------|-------------------------------------|
| label       | `string`                  | Label above the range inputs        |
| minVal      | `string`                  | Current min value                   |
| maxVal      | `string`                  | Current max value                   |
| onMinChange | `(v: string) => void`     | Callback when min input changes     |
| onMaxChange | `(v: string) => void`     | Callback when max input changes     |

### `DeleteFiltersButton` (function component)

Renders a red "Delete All Filters" button with a trash icon.

| Prop    | Type         | Description                       |
|---------|--------------|-----------------------------------|
| onClick | `() => void` | Callback fired on button click    |

---

## 10. Sidebar (`src/components/Sidebar.tsx`)

### Sub-components
| Component  | Props                                                    | Description                                                     |
|------------|----------------------------------------------------------|-----------------------------------------------------------------|
| `NavIcon`  | `{ src: string, alt: string, href: string, active?: boolean }` | Renders a single sidebar navigation icon as a `Link` with active highlight |

### `Sidebar` (default export, function component)

| Internal Hook      | Description                                                    |
|---------------------|----------------------------------------------------------------|
| `useTheme()`        | Gets `resolvedTheme` and `setTheme` from `next-themes`        |
| `usePathname()`     | Gets current URL path to determine which nav icon is active    |

No explicit methods — renders a vertical sidebar with logo, 3 nav icons (Supply Chain Dashboard, Inventory, Decision Making), theme toggle button, logout icon, and settings icon.

---

## 11. SupplyChainFlow (`src/components/SupplyChainFlow.tsx`)

SVG-based sankey-style supply chain visualization. Each node is a clickable SVG shape.

### Attributes (module-level constants)
| Name     | Type     | Description                                           |
|----------|----------|-------------------------------------------------------|
| BLUE     | `string` | Colour for active nodes (`#2969FF`)                   |
| RED      | `string` | Colour for disrupted nodes (`#FF2929`)                |
| FRAME_W  | `number` | SVG frame width (`608.40`)                            |
| FRAME_H  | `number` | SVG frame height (`141`)                              |
| PIECES   | `array`  | Array of 8 SVG path definitions mapping to supply chain node IDs, with position/size |

### Props
| Prop        | Type      | Default | Description                                   |
|-------------|-----------|---------|-----------------------------------------------|
| heightScale | `number`  | `1`     | Multiplier for the frame height               |

### Methods
| Method        | Signature                               | Description                                                              |
|---------------|-----------------------------------------|--------------------------------------------------------------------------|
| `handleClick` | `(node: SupplyChainNode) => void`       | Navigates to `/inventory/warehousing?process={nodeId}` when a node is clicked |

### Internal State
| State     | Type             | Description                           |
|-----------|------------------|---------------------------------------|
| hoveredId | `string \| null` | ID of currently hovered node for tooltip |

---

## 12. WarehouseInspector (`src/components/WarehouseInspector.tsx`)

Right-panel inspector displaying details for a selected warehouse row.

### `WarehouseForInspector` (exported type)
| Attribute        | Type     | Description                   |
|------------------|----------|-------------------------------|
| warehouseId      | `string` | Warehouse unique ID           |
| warehouseName    | `string` | Full display name             |
| region           | `string` | Geographic region             |
| coordinates      | `string` | GPS coordinates               |
| hours            | `string` | Operational hours             |
| status           | `string` | Open/Closed                   |
| address          | `string` | Street address                |
| usedCapacity     | `number` | Computed used capacity        |
| totalCapacity    | `number` | Maximum capacity              |
| objectCategory   | `string` | Primary category              |
| businessLinkType | `string` | Business link type            |

### Props
| Prop      | Type                    | Description                      |
|-----------|-------------------------|----------------------------------|
| warehouse | `WarehouseForInspector` | The warehouse to display         |

### Internal Computed Variables
| Name     | Computation                                        | Description                                         |
|----------|----------------------------------------------------|-----------------------------------------------------|
| capPct   | `(usedCapacity / totalCapacity) * 100` rounded to 2dp | Used capacity as percentage                        |
| capPos   | `capPct >= 30`                                     | Whether capacity is in healthy range                |
| capLabel | `"{capPct}%"`                                       | Formatted percentage string                         |

No exported methods — purely renders: warehouse details table, map placeholder, statistics section, chart placeholder, and object table placeholder.

---

## 13. ObjectInspector (`src/components/ObjectInspector.tsx`)

Right-panel inspector displaying details for a selected object row.

### `ObjectForInspector` (exported type)
| Attribute      | Type     | Description                    |
|----------------|----------|--------------------------------|
| objectId       | `string` | Object unique ID               |
| objectCategory | `string` | Category classification        |
| quantity       | `number` | Quantity value                  |
| unit           | `string` | Unit of measurement            |
| arrivalTime    | `string` | Arrival timestamp              |
| transitStatus  | `string` | Transit state                  |
| objectHealth   | `string` | Health percentage string       |
| warehouseId    | `string` | Parent warehouse ID            |

### Props
| Prop   | Type                 | Description                 |
|--------|----------------------|-----------------------------|
| object | `ObjectForInspector` | The object to display       |

### Internal Computed Variables
| Name      | Computation                           | Description                                       |
|-----------|---------------------------------------|---------------------------------------------------|
| healthNum | `parseFloat(objectHealth)`            | Numeric health value                              |
| healthPos | `Math.abs(healthNum) >= 30`           | Whether health is in positive range               |

No exported methods — purely renders an object details table with colour-coded transit status and health.

---

## 14. RootLayout (`src/app/layout.tsx`)

### Attributes (module-level)
| Name      | Type   | Description                              |
|-----------|--------|------------------------------------------|
| geistSans | `Font` | Geist Sans font instance with CSS variable `--font-geist-sans` |
| geistMono | `Font` | Geist Mono font instance with CSS variable `--font-geist-mono` |
| metadata  | `Metadata` | Page metadata: title = `"Entity — Supply Chain Management"` |

### `RootLayout` (default export, function component)
| Prop     | Type        | Description             |
|----------|-------------|-------------------------|
| children | `ReactNode` | Page content to render  |

Wraps children in: `<html>` → `<body>` → `<ThemeProvider>` → `<ErrorBoundary>` → `{children}`.

---

## 15. Home Page (`src/app/page.tsx`)

### `Home` (default export, function component)
No props, no state, no methods. Calls `redirect('/login')` to redirect to the login page.

---

## 16. LoginPage (`src/app/login/page.tsx`)

### `LoginPage` (default export, function component)

### Internal State
| State        | Type      | Description                            |
|--------------|-----------|----------------------------------------|
| rememberMe   | `boolean` | Whether "Remember Me" checkbox is checked |

### Internal Hooks
| Hook         | Returns               | Description                              |
|--------------|-----------------------|------------------------------------------|
| `useTheme()` | `resolvedTheme, setTheme` | Theme toggle for sidebar button       |

No exported methods — renders: left sidebar with theme toggle, login form with username/password fields, remember-me checkbox, and login button.

---

## 17. InventoryPage (`src/app/inventory/page.tsx`)

### `InventoryPage` (default export, function component)

No state, no methods. Renders: `Sidebar`, top bar, `SupplyChainFlow` (heightScale 1.3), and a table of `supplyChainNodes` as clickable rows linking to `/inventory/warehousing?process={nodeId}`.

---

## 18. WarehousingPage (`src/app/inventory/warehousing/page.tsx`)

### Module-level Constants
| Name                  | Type                                    | Description                                          |
|-----------------------|-----------------------------------------|------------------------------------------------------|
| WAREHOUSE_FILTER_CATS | `{ key: string; label: string }[]`      | 4 warehouse filter categories: Object Category, Business Link Type, Region, Status |
| OBJECT_FILTER_CATS    | `{ key: string; label: string }[]`      | 3 object filter categories: Object Category, Transit Status, Unit |
| RECORDS_PER_PAGE      | `number`                                | Pagination page size (`20`)                          |
| WAREHOUSE_COLUMNS     | `{ label: string; minW: number }[]`     | 7 column definitions for warehouse table             |
| OBJECT_COLUMNS        | `{ label: string; minW: number }[]`     | 6 column definitions for object table                |

### Module-level Functions
| Function | Signature                                         | Description                                                            |
|----------|----------------------------------------------------|------------------------------------------------------------------------|
| `rowBg`  | `(index: number, isSelected: boolean) => string`  | Returns Tailwind class string for alternating row background + selected highlight |

### `WarehousingContent` (internal function component)

#### Internal State
| State              | Type                          | Description                                       |
|--------------------|-------------------------------|---------------------------------------------------|
| selectedIdx        | `number`                      | Index of selected warehouse row on current page    |
| page               | `number`                      | Current pagination page (0-based)                  |
| filters            | `Record<string, Set<string>>` | Active warehouse filter values per category        |
| expandedCats       | `Set<string>`                 | Which warehouse filter categories are expanded     |
| capacityMin        | `string`                      | Min capacity range filter value                    |
| capacityMax        | `string`                      | Max capacity range filter value                    |
| drilledWarehouseIdx| `number \| null`              | Index into filteredWarehouses of drilled-in warehouse (null = warehouse view) |
| selectedObjectIdx  | `number`                      | Index of selected object row in drilled view       |
| objectFilters      | `Record<string, Set<string>>` | Active object filter values per category           |
| objectExpandedCats | `Set<string>`                 | Which object filter categories are expanded        |
| objectHealthMin    | `string`                      | Min object health range filter value               |
| objectHealthMax    | `string`                      | Max object health range filter value               |

#### Internal Methods / Callbacks
| Method / Callback           | Signature                                          | Description                                                                          |
|-----------------------------|-----------------------------------------------------|--------------------------------------------------------------------------------------|
| `handleToggleFilter`        | `(key: string, value: string) => void`             | Toggles a warehouse filter checkbox; resets page and selection to 0                  |
| `handleClearFilters`        | `() => void`                                       | Clears all warehouse filters, capacity range, expanded state; resets pagination       |
| `handleToggleObjectFilter`  | `(key: string, value: string) => void`             | Toggles an object filter checkbox; resets object selection to 0                       |
| `handleClearObjectFilters`  | `() => void`                                       | Clears all object filters, health range, expanded state; resets object selection      |
| `capacityRangeCheck`        | `(w: Warehouse) => boolean`                        | Returns whether a warehouse passes the capacity min/max range filter                 |
| `getWarehouseOptionCount`   | `(catKey: string, optValue: string) => number`     | Computes dynamic count for a warehouse filter option (delegates to `computeToggleCount`) |
| `healthRangeCheck`          | `(o: ObjectRecord) => boolean`                     | Returns whether an object passes the object-health min/max range filter              |
| `deriveObjectOptions`       | `(key: string) => { value: string }[]`             | Derives unique filter options for object filter categories from current warehouse objects |
| `getObjectOptionCount`      | `(catKey: string, optValue: string) => number`     | Computes dynamic count for an object filter option (delegates to `computeToggleCount`)   |

#### Internal Computed / Derived Values
| Name               | Type                | Description                                                     |
|--------------------|---------------------|-----------------------------------------------------------------|
| processId          | `string \| null`    | Query param `?process=` from URL                                |
| processName        | `string`            | Resolved name of the process node, or `"All"`                   |
| processWarehouses  | `Warehouse[]`       | Warehouses filtered by processId (memoized)                     |
| filteredWarehouses | `Warehouse[]`       | processWarehouses after applying all active filters (memoized)  |
| totalPages         | `number`            | Total pagination pages                                          |
| pageRecords        | `Warehouse[]`       | Current page slice of filteredWarehouses                        |
| sel                | `Warehouse`         | Currently selected warehouse for inspector                      |
| drilledWarehouse   | `Warehouse \| null` | The warehouse being drilled into (or null)                      |
| warehouseObjects   | `ObjectRecord[]`    | Objects belonging to drilledWarehouse (memoized, key-based join)|
| filteredObjects    | `ObjectRecord[]`    | warehouseObjects after applying object filters (memoized)       |
| selObject          | `ObjectRecord`      | Currently selected object for inspector                         |
| objectForInspector | `object \| null`    | Shaped object passed to `ObjectInspector`                       |

### `WarehousingPage` (default export)
Wraps `WarehousingContent` in `<Suspense>` (required because it uses `useSearchParams`).

---

## 19. SupplyChainDashboardPage (`src/app/supply-chain-dashboard/page.tsx`)

### Module-level Constants / Computed
| Name            | Type                            | Description                                              |
|-----------------|---------------------------------|----------------------------------------------------------|
| avgHealth       | `number`                        | Average object health across all objects (rounded)        |
| recentActivity  | `{ text: string; time: string }[]` | Formatted recent activity entries                     |
| TRANSIT_COLORS  | `string[]`                      | 5 green-shade hex colours for transit stacked bar chart   |

### `SupplyChainDashboardPage` (default export, function component)

#### Internal State
| State             | Type     | Description                                          |
|-------------------|----------|------------------------------------------------------|
| transitProcessId  | `string` | Selected node ID for "Transit Stock Distribution"    |
| capacityProcessId | `string` | Selected node ID for "Warehouse Capacity Stats"      |

#### Internal Computed (memoized)
| Name               | Type      | Description                                                                |
|--------------------|-----------|----------------------------------------------------------------------------|
| transitWarehouses  | `array`   | Top-5 warehouses for selected process with in-transit quantities + percentages (memoized) |
| capacityWarehouses | `array`   | Top-5 warehouses for selected process with capacity percentages (memoized) |

### Sub-components (file-local)
| Component      | Props                                                      | Description                                                    |
|----------------|------------------------------------------------------------|----------------------------------------------------------------|
| `StatCard`     | `{ bg: string, value: string, label: string, valueClass?: string }` | Renders a single stat card with large value text and label |
| `SectionTitle` | `{ children: ReactNode }`                                  | Renders a section heading in a white/dark box                  |
| `NodeDropdown` | `{ value: string, onChange: (v: string) => void }`         | Renders a `<select>` dropdown of all supply chain nodes        |

---

## 20. DecisionMakingPage (`src/app/decision-making/page.tsx`)

### `DecisionMakingPage` (default export, function component)

#### Internal State
| State            | Type          | Description                                 |
|------------------|---------------|---------------------------------------------|
| expandedSections | `Set<string>` | Which filter sections are expanded           |
| checkedFilters   | `Set<string>` | Which filter checkboxes are checked          |
| inputValue       | `string`      | Current text in the AI agent chat input      |

#### Internal Methods
| Method           | Signature              | Description                                                         |
|------------------|------------------------|---------------------------------------------------------------------|
| `toggleSection`  | `(id: string) => void` | Toggles a filter section between expanded/collapsed                 |
| `toggleFilter`   | `(key: string) => void`| Toggles a filter checkbox on/off                                    |
| `clearAllFilters`| `() => void`           | Clears all checked filters                                          |

Renders three columns: (1) Quick Action filters from `dmp-filters.json`, (2) Map placeholder for "Real Time War Board", (3) AI Agent inspector panel showing conversation from `ai-agent-simulations.json` with chat input at the bottom.

---

## Relationships Summary (for class diagram)

```
SupplyChainNode  1──*  WarehouseRelationship  (via processId)
WarehouseRelationship  1──1  Warehouse  (via warehouseId)
RawWarehouse  ──extends──>  Warehouse  (with computed fields)
ObjectRelationship  1──1  ObjectRecord  (via objectId)
ObjectRelationship  *──1  Warehouse  (via warehouseId)

FilterSection  1──*  FilterItem
AgentConversation  1──*  AgentMessage
AgentMessage  0──*  AgentOption
AIAgentConfig  1──*  AgentConversation

Sidebar  ──used-by──>  InventoryPage, WarehousingPage, SupplyChainDashboardPage, DecisionMakingPage
SupplyChainFlow  ──used-by──>  InventoryPage, SupplyChainDashboardPage
WarehouseInspector  ──used-by──>  WarehousingPage
ObjectInspector  ──used-by──>  WarehousingPage
CheckboxFilterSections  ──used-by──>  WarehousingPage
RangeFilter  ──used-by──>  WarehousingPage
DeleteFiltersButton  ──used-by──>  WarehousingPage
ErrorBoundary  ──used-by──>  RootLayout
StatCard, SectionTitle, NodeDropdown  ──used-by──>  SupplyChainDashboardPage

allObjects  ──consumed-by──>  WarehousingPage, SupplyChainDashboardPage
allWarehouses  ──consumed-by──>  WarehousingPage, SupplyChainDashboardPage
supplyChainNodes  ──consumed-by──>  InventoryPage, SupplyChainDashboardPage, SupplyChainFlow
```
