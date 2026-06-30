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
  return pages
    // A page tagged with form_versions belongs only to those revisions: hide a
    // retired pre-2016 schedule (230, 339, ...) on a current-form filing, and a
    // current-only schedule (210A) on a legacy filing. Untagged pages show always.
    .filter((page) => !page.form_versions || page.form_versions.includes(formVersion))
    .map((page) => {
      const variant = page.schedule && variants[page.schedule]?.[formVersion]
      if (!variant) return page
      // Render the older form's grid under the current revision's nav label.
      return { ...page, cols: variant.cols, rows: variant.rows, rowBreaks: variant.rowBreaks }
    })
}
