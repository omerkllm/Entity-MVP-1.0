/**
 * Factory Method for MapLibre pin markers.
 *
 * Three pin variants share the same skeleton — a div with a class, an inline
 * SVG image, a tooltip, a click handler, and a popup — but differ in icon,
 * styling class, and popup body. Inlining all three in `layers.ts` led to ~25
 * lines of near-duplicated DOM construction per variant.
 *
 * `createPinMarker` is the factory: pass the variant kind + a small config and
 * it returns a fully-constructed `maplibregl.Marker`. Adding a fourth variant
 * (e.g. 'disruption') is one new entry in `PIN_VARIANTS` plus an icon path —
 * no copy-paste of marker plumbing.
 */
import maplibregl from 'maplibre-gl'

export type PinKind = 'warehouse' | 'business-linked' | 'business-external'

interface PinVariant {
  /** CSS class applied to the marker element (must exist in globals.css). */
  className: string
  /** Path to the SVG icon under public/. */
  iconSrc: string
}

const PIN_VARIANTS: Record<PinKind, PinVariant> = {
  warehouse:           { className: 'dmp-pin dmp-pin-warehouse', iconSrc: '/icons/warehouse.svg' },
  'business-linked':   { className: 'dmp-pin dmp-pin-supplier',  iconSrc: '/icons/business.svg' },
  'business-external': { className: 'dmp-pin dmp-pin-external',  iconSrc: '/icons/business.svg' },
}

export interface PinConfig {
  kind: PinKind
  lngLat: [number, number]
  /** Tooltip text and accessible label. */
  title: string
  /** Inner HTML for the popup. Caller is responsible for escaping. */
  popupHtml: string
  /** Fired when the pin element (not the popup) is clicked. */
  onClick?: () => void
}

export function createPinMarker(cfg: PinConfig): maplibregl.Marker {
  const variant = PIN_VARIANTS[cfg.kind]

  const el = document.createElement('div')
  el.className = variant.className
  el.innerHTML = `<img src="${variant.iconSrc}" alt="" />`
  el.title = cfg.title

  if (cfg.onClick) {
    el.addEventListener('click', e => {
      e.stopPropagation()
      cfg.onClick!()
    })
  }

  const popup = new maplibregl.Popup({ offset: 18, closeButton: false, maxWidth: '200px' })
    .setHTML(cfg.popupHtml)

  return new maplibregl.Marker({ element: el, anchor: 'center' })
    .setLngLat(cfg.lngLat)
    .setPopup(popup)
}
