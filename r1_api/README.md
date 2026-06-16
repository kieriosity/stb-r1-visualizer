# STB R-1 Local API Server

Serves a canonical STB Form R-1 JSON file as a structured REST API.
Auto-detects the shape of each schedule (rows / items / sections / categories / answers)
and generates appropriate endpoints.

## Setup

```bash
# 1. Copy your JSON file into this folder and rename it
cp path/to/stb-r1-bnsf-2025-v1.json ./data.json

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run
uvicorn main:app --reload --port 8000
```

Then open **http://localhost:8000/docs** for interactive Swagger UI.

## Endpoints

### Meta
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | API overview, carrier info, schedule list |
| GET | `/docs` | Interactive Swagger UI |

### Submission
| Method | Path | Description |
|--------|------|-------------|
| GET | `/submission` | Full envelope |
| GET | `/submission/metadata` | Form metadata (submission_id, report_year, currency, …) |
| GET | `/submission/respondent` | Carrier identity (name, reporting_mark, address) |
| GET | `/submission/officer` | Officer in charge |
| GET | `/submission/verification` | Verification / notary block |

### Schedules
| Method | Path | Description |
|--------|------|-------------|
| GET | `/schedules` | Index of all schedules with shape + count |
| GET | `/schedules?shape=rows` | Filter index by shape |
| GET | `/schedules/{id}` | Full schedule (revision + data) |
| GET | `/schedules/{id}/revision` | Revision metadata only |
| GET | `/schedules/{id}/data` | Paginated data collection |
| GET | `/schedules/{id}/data?line_no=5` | Filter by line number |
| GET | `/schedules/{id}/data?title=cash` | Substring match on title |
| GET | `/schedules/{id}/data?section_id=A` | Filter by section (sections shape) |
| GET | `/schedules/{id}/data/{line_no}` | Single record by line_no |

### Search
| Method | Path | Description |
|--------|------|-------------|
| GET | `/search/title?q=cash` | Search all schedule titles |
| GET | `/search/title?q=cash&schedule_id=200` | Scoped to one schedule |

### Footnotes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/footnotes` | All footnotes |

## Schedule Shapes

Each schedule is one of five shapes — the API handles all of them:

| Shape | Data key | Example schedules |
|-------|----------|-------------------|
| `rows` | `rows[]` → `{line_no, title, cells{}}` | 330, 332, 410, 700 |
| `items` | `items[]` → `{line_no, fields{}}` | 310, 501, 510 |
| `sections` | `sections[]` → `{section_id, lines[]}` | 200, 210, 450 |
| `categories` | `categories[]` → `{category_id, line_no, measures{}}` | 710, 710S |
| `answers` | `answers{}` → `{Q1, Q2, …}` | B, C |

## Multiple carriers / years

To serve multiple files, run separate instances on different ports:

```bash
# Terminal 1 — BNSF 2025
cp stb-r1-bnsf-2025-v1.json stb_r1_api_bnsf/data.json
cd stb_r1_api_bnsf && uvicorn main:app --port 8001

# Terminal 2 — NS 2025
cp stb-r1-ns-2025-v1.json stb_r1_api_ns/data.json
cd stb_r1_api_ns && uvicorn main:app --port 8002
```

Or see `main.py` — swap `DATA_FILE` to read from an env var for a single
multi-carrier instance with path routing.
