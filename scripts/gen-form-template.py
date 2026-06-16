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
XLSX = ROOT / 'forms' / 'R1-7-31-2026.xlsx'
OUT = ROOT / 'r1_visualizer' / 'src' / 'formTemplate.json'

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


def main():
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    out = {'pages': []}
    for name in wb.sheetnames:
        ws = wb[name]
        grid = extract_sheet(ws)
        if grid is None:
            continue
        grid['sheet'] = name
        grid['schedule'] = sheet_to_schedule(name)
        out['pages'].append(grid)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
    size = os.path.getsize(OUT)
    print(f'wrote {OUT}  ({size/1024:.0f} KB, {len(out["pages"])} pages)')
    # quick report
    for p in out['pages'][:8]:
        print(f'  {p["sheet"]:28} sched={p["schedule"]}  rows={len(p["rows"])} cols={len(p["cols"])}')


if __name__ == '__main__':
    main()
