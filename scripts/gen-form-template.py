"""Extract the STB R-1 xlsx form template into a compact JSON grid the web
viewer renders as a near-pixel facsimile. Static labels, instruction text,
column widths, borders, fonts and alignment come straight from the official
template; the viewer overlays each submission's numeric values into the
empty bordered value cells.

Run:
    python scripts/gen-form-template.py
Writes r1_visualizer/src/formTemplate.json
"""
import json, re, os, datetime
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'r1_visualizer' / 'src' / 'formTemplate.json'

# The STB renumbered Schedule 200 (and revised 210, added 210A) between these
# revisions, so the facsimile is generated per form version and the viewer renders
# whichever matches the filing's envelope.form_metadata.form_version. Identical
# pages are emitted once and tagged with both versions to keep the bundle small.
# Chronological order; the LAST entry is the canonical page order for the nav.
FORMS = [
    ('2015-08-31', ROOT / 'forms' / 'R1-08-31-2015.xlsx'),
    ('2026-07-31', ROOT / 'forms' / 'R1-7-31-2026.xlsx'),
]

# Sheet name -> data schedule_id (None = front matter / instructions, shown
# static). Keeps form order via the workbook's own sheet order.
def sheet_to_schedule(name):
    n = name.strip()
    if re.search(r'inst', n, re.I):
        return None
    m = re.match(r'^(PTC)\s*([0-9]{3}[a-zA-Z]?)', n)
    if m:
        return f'PTC_{m.group(2).upper()}'
    m = re.match(r'^([0-9]{3}[a-zA-Z]?)\b', n)
    if m:
        return m.group(1).upper()
    return None


def ha_code(al):
    h = al.horizontal
    return {
        'center': 'c', 'centerContinuous': 'cc', 'right': 'r',
        'left': 'l', 'general': None,
    }.get(h, None) if h else None


def has_border(side):
    return bool(side and side.style)


def cell_borders(cell):
    b = cell.border
    return (has_border(b.top), has_border(b.bottom), has_border(b.left), has_border(b.right))


def display_text(cell):
    v = cell.value
    if v is None:
        return None
    # Year-range header cells come through as dates; the form shows only the
    # year. Everything else should mimic Excel's displayed text where the raw
    # value alone is misleading.
    if isinstance(v, (datetime.datetime, datetime.date)):
        return str(v.year)
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        fmt = cell.number_format or ''
        if v < 0 and re.search(r'\([^)]*0[^)]*\)', fmt):
            n = abs(v)
            if float(n).is_integer():
                return f'({int(n):,})'
            return f'({n:,})'
    return str(v)


def extract_sheet(ws):
    maxc = ws.max_column
    # Trim trailing rows: keep through the last row carrying text.
    last = 0
    for r in range(1, ws.max_row + 1):
        for c in range(1, maxc + 1):
            if ws.cell(row=r, column=c).value is not None:
                last = r
                break
    if last == 0:
        return None
    last = min(last + 1, ws.max_row)

    # Column widths (Excel units); default ~8.43. Trim trailing empty columns.
    widths = []
    for c in range(1, maxc + 1):
        letter = openpyxl.utils.get_column_letter(c)
        dim = ws.column_dimensions.get(letter)
        widths.append(round(dim.width, 2) if dim and dim.width else 8.43)

    rows = []
    row_numbers = []
    for r in range(1, last + 1):
        rd = ws.row_dimensions.get(r)
        cells = []
        for c in range(1, maxc + 1):
            cell = ws.cell(row=r, column=c)
            v = cell.value
            bt, bb, bl, br = cell_borders(cell)
            if v is None and not (bt or bb or bl or br):
                continue
            o = {'c': c - 1}
            if v is not None:
                o['t'] = display_text(cell)
            f = cell.font
            if f.bold:
                o['b'] = 1
            if f.italic:
                o['i'] = 1
            if f.size and abs(f.size - 7) > 0.1:
                o['sz'] = f.size
            ha = ha_code(cell.alignment)
            if ha:
                o['ha'] = ha
            if cell.alignment.wrap_text:
                o['w'] = 1
            if cell.alignment.textRotation:
                o['tr'] = cell.alignment.textRotation
            bd = (bt and 't' or '') + (bb and 'b' or '') + (bl and 'l' or '') + (br and 'r' or '')
            if bd:
                o['bd'] = bd
            cells.append(o)
        if cells or (rd and rd.height):
            row = {'cells': cells}
            if rd and rd.height:
                row['h'] = round(rd.height, 1)
            rows.append(row)
            row_numbers.append(r)

    row_breaks = []
    for brk in ws.row_breaks.brk:
        # openpyxl break IDs are the last Excel row before a manual page break.
        # Store the corresponding zero-based row-array index where the next
        # printed page begins, so renderers do not need original Excel row IDs.
        idx = next((i for i, row_num in enumerate(row_numbers) if row_num > brk.id), None)
        if idx is not None and 0 < idx < len(rows):
            row_breaks.append(idx)

    grid = {'cols': widths, 'rows': rows}
    if row_breaks:
        grid['rowBreaks'] = sorted(set(row_breaks))
    return grid


def extract_form(path):
    """sheet name -> grid dict (cols/rows/[rowBreaks]/sheet/schedule) for one form."""
    wb = openpyxl.load_workbook(path, data_only=True)
    sheets = {}
    for name in wb.sheetnames:
        grid = extract_sheet(wb[name])
        if grid is None:
            continue
        grid['sheet'] = name
        grid['schedule'] = sheet_to_schedule(name)
        sheets[name] = grid
    return wb.sheetnames, sheets


def _grid_body(grid):
    body = {'cols': grid['cols'], 'rows': grid['rows']}
    if 'rowBreaks' in grid:
        body['rowBreaks'] = grid['rowBreaks']
    return body


def main():
    versions = [v for v, _ in FORMS]
    latest = versions[-1]                 # the current revision drives the page list / nav
    per_version = {}                      # version -> {schedule_id: grid}
    base_pages = None
    for v, path in FORMS:
        names, sheets = extract_form(path)
        ordered = [sheets[n] for n in names if n in sheets]
        per_version[v] = {g['schedule']: g for g in ordered if g['schedule']}
        if v == latest:
            base_pages = ordered           # full page set (incl. instruction pages)

    # The NAV/page list always comes from the current revision (clean sheet names,
    # separate instruction pages). For schedules the older form drew differently we
    # keep its grid as a variant; the viewer swaps it in when a filing is on that
    # revision, so old filings still match their own printed form.
    variants = {}                          # schedule -> {older_version: grid body}
    for v in versions[:-1]:
        for sched, grid in per_version[v].items():
            base = per_version[latest].get(sched)
            if base is None:
                continue                   # legacy schedule dropped from the current form
            if (grid['cols'], grid['rows']) != (base['cols'], base['rows']):
                variants.setdefault(sched, {})[v] = _grid_body(grid)

    out = {'form_versions': versions, 'default_version': latest,
           'pages': base_pages, 'variants': variants}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
    size = os.path.getsize(OUT)
    print(f'wrote {OUT}  ({size/1024:.0f} KB, {len(base_pages)} pages from {latest}, '
          f'{len(variants)} schedules with older-form variants)')
    for sched in ('200', '210', '210A'):
        vs = list(variants.get(sched, {}))
        print(f'  {sched:5} variants={vs}')


if __name__ == '__main__':
    main()
