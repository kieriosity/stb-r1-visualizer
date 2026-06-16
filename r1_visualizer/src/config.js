// Runtime configuration. Overridable per-mount (WordPress shortcode passes
// data-* attributes) so the same bundle works standalone and embedded.

export const DEFAULTS = {
  // Base URL where the JSON files + manifest.json live.
  //  - dev:        served by the Vite plugin at /data
  //  - WordPress:  e.g. "/wp-content/uploads/r1-data" or a CDN URL
  dataBase: '/data',
  monetaryUnits: 'thousands',
}

export function resolveConfig(opts = {}) {
  return { ...DEFAULTS, ...opts }
}
