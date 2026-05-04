/**
 * Adapters between DB-shape and UI-shape entities.
 *
 * The DB (`DBBusiness`) and the map UI (`BusinessPin`) speak different
 * vocabularies — the DB row carries `businessId` + capitalised `linkType`
 * ('Supplier' | 'Customer' | null), while the map needs an `id` field and
 * lowercase 'supplier' | 'customer' to match its `LINK_TYPE_COLORS` keys.
 *
 * Putting the conversion here (instead of inlining it in every consumer)
 * names the seam between the two shapes, so:
 *   - Schema changes touch one function instead of N call sites.
 *   - Pin display logic (e.g. the synthesised `name` field) is centralised
 *     and testable without a React render.
 *   - New consumers (e.g. a future "businesses" table view) reuse the
 *     same canonical UI shape instead of re-deriving it.
 */
import type { DBBusiness } from '@/lib/data/types'
import type { BusinessPin } from '@/components/map/types'

export function dbBusinessToPin(b: DBBusiness): BusinessPin {
  return {
    id: b.businessId,
    name: `${b.objectCategory} (${b.region})`,
    coordinates: b.coordinates,
    objectCategory: b.objectCategory,
    linkType: b.linkType ? (b.linkType.toLowerCase() as 'supplier' | 'customer') : null,
    linkedWarehouseIds: b.linkedWarehouseIds,
  }
}
