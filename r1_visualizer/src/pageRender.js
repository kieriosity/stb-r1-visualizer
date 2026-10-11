const FILLED_FRONT_MATTER_ONLY = new Set(['Title', 'Cover'])

export function shouldRenderFacsimile(page) {
  return !page?.filedOnly && !FILLED_FRONT_MATTER_ONLY.has(page?.sheet)
}
