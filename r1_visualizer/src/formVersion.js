// Form-version-aware facsimile selection. The nav / page list always comes from
// the current form revision (clean sheet names, separate instruction pages); only
// the rendered GRID swaps to an older revision's layout for the schedules the STB
// drew differently (e.g. Schedule 200 had 29 asset lines before 2016, 28 after).
// formTemplate.json: { pages: [<current pages>], variants: { <schedule>: { <older
// version>: {cols, rows, rowBreaks} } }, default_version }.

export function resolveFormVersion(doc, template) {
  return (
    doc?.envelope?.form_metadata?.form_version ||
    template?.default_version ||
    template?.form_versions?.[template.form_versions.length - 1] ||
    null
  )
}

export function pagesForVersion(template, formVersion) {
  const pages = template?.pages || []
  const variants = template?.variants || {}
  if (!formVersion) return pages
  return pages.map((page) => {
    const variant = page.schedule && variants[page.schedule]?.[formVersion]
    if (!variant) return page
    // Render the older form's grid under the current revision's nav label.
    return { ...page, cols: variant.cols, rows: variant.rows, rowBreaks: variant.rowBreaks }
  })
}
