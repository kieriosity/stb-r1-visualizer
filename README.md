# STB R-1 Visualizer

Tools for browsing canonical STB Form R-1 JSON as a form-faithful, client-side
facsimile of the printed annual report.

## Repository layout

- `r1_visualizer/` - Preact/Vite front end and WordPress shortcode wrapper.
- `stb_r1_json/` - canonical STB R-1 JSON submissions used by the viewer.
- `forms/` - official Form R-1 workbook/PDF inputs used to derive the visual
  template.
- `scripts/` - helpers for regenerating the extracted form template.
- `r1_api/` - optional local FastAPI server for exploring the same JSON data.

## Visualizer status

The viewer reconstructs the official Excel template cell-by-cell and overlays
submission data into the matching value cells. Current form-fidelity support
includes:

- nested grouped matrix cells for schedules `332`, `PTC_332`, `414`, and `415`;
- duplicate line-number handling for schedules with multiple header bands;
- parenthesized account labels from the Excel display format;
- stacked vertical side labels from Excel text rotation;
- static template markers such as `N/A` and `XXXXXX`, including schedule `710`
  continuation rows.

Column mapping is driven by generated `columnSpec.json` metadata plus header
tokens from the extracted template. Nested JSON paths use dotted keys, for
example `owned_and_used.depreciation_base_beginning_of_year`.

## Run locally

```bash
cd r1_visualizer
npm install
npm run dev
```

Open `http://localhost:5173`. The Vite dev server serves the sibling
`stb_r1_json/` folder at `/data` and synthesizes `/data/manifest.json`, so no
data copy is needed for local development.

Deep-link to a schedule with `?sched=<id>`, for example:

```text
http://localhost:5173/?sched=710
```

## Source page comparison

When the host supplies `data-source-base`, **Compare source pages** opens the
original PDF beside the extracted form. The source endpoint is provided by the
pipeline's steward and standalone servers. Previous/Next and a page selector
navigate physical PDF pages. **Page together** is enabled by default: the
extraction advances through the associated schedule's printed pages with the PDF.
Each pane still has independent zoom and scrolling.
The right selector lists form pages associated with the source page's schedules.
Pairing starts from page order within the schedule. A manual selection becomes
the starting point for subsequent paired navigation; turn off **Page together**
to retain manual selection within that schedule. If the source and form have
different page counts, navigation stops at the first/last extracted page without
wrapping. Explanatory notes remain manually selectable. Schedule lineage does
not prove page correspondence or identify exact rows or image regions. An unmapped
source page clears the extraction pane. Amendments and OCR correction pages are
explicitly labeled.

Append `sourcePage=124` to a filing URL to open comparison at that PDF page.
Source requests include the filing version and bind image requests to the
manifest's output/log/source identity. An unavailable or changed source shows a
message; the app does not substitute another filing or OCR text. Static and
WordPress hosts without the source endpoint keep the ordinary form view.

## Issue reports

Hosts that provide `data-issues-base` enable **Report issue** in both form and
source-comparison views, plus **View issue log**. The report dialog captures the
filing/version, displayed output SHA-256, selected schedules and extracted panel,
and (in comparison mode) the physical PDF page and source binding. Select an issue
type and describe the observed/expected behavior. The backend saves a separate
JSON report with source/run identity; failures retain the draft and retries reuse
the same issue ID. Saving does not change extracted data or review approval state.
Use localhost or HTTPS for reporting; without Web Crypto the viewer still renders
but cannot bind a report to the loaded output. Static hosts without an issue
endpoint omit these controls. See the pipeline's `docs/transformation-issues/README.md`
for storage, context limits, and triage.

## Verify changes

```bash
cd r1_visualizer
npm test
npm run build
```

The build emits `dist/r1-viewer.js` and `dist/r1-viewer.css`. A large bundle
warning is currently expected because the form template JSON is bundled with
the app.

## Regenerate the form template

When the official workbook changes, regenerate the extracted template:

```bash
python scripts/gen-form-template.py
```

This updates `r1_visualizer/src/formTemplate.json`. The extractor preserves
cell borders, widths, fonts, spans, text rotation, and Excel display text used
by the visualizer.

## WordPress deployment

1. Build the front end from `r1_visualizer/`.
2. Copy `dist/r1-viewer.js` and `dist/r1-viewer.css` into
   `r1_visualizer/wordpress/assets/`.
3. Upload the canonical JSON files plus `manifest.json` to the configured data
   base, usually `wp-content/uploads/r1-data/`.
4. Activate the plugin and use:

```text
[r1_viewer carrier="BNSF" year="2025"]
```

See `r1_visualizer/README.md` for the lower-level architecture notes.
