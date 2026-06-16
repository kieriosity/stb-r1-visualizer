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
