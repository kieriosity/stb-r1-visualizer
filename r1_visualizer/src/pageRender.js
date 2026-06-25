const FILLED_FRONT_MATTER_ONLY = new Set(['Title', 'Cover'])

export function shouldRenderFacsimile(page) {
  return !FILLED_FRONT_MATTER_ONLY.has(page?.sheet)
}
