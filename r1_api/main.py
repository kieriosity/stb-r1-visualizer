"""
STB R-1 Local API Server
Serves a canonical STB-R1 JSON submission as a structured REST API.

Usage:
    pip install fastapi uvicorn
    uvicorn main:app --reload --port 8000

Then open: http://localhost:8000/docs
"""

import json
import sys
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse

# ---------------------------------------------------------------------------
# Load data
# ---------------------------------------------------------------------------

DATA_FILE = Path(__file__).parent / "data.json"

if not DATA_FILE.exists():
    print(f"ERROR: data.json not found at {DATA_FILE}")
    print("Copy your STB R-1 JSON file to the same folder as main.py and rename it data.json")
    sys.exit(1)

with open(DATA_FILE) as f:
    DB: dict = json.load(f)

ENVELOPE: dict = DB.get("envelope", {})
FOOTNOTES: list = DB.get("footnotes", [])
SCHEDULES: dict = DB.get("schedules", {})

# ---------------------------------------------------------------------------
# Shape detection
# ---------------------------------------------------------------------------

SHAPE_KEYS = {
    "rows":       "rows",
    "items":      "items",
    "sections":   "sections",
    "categories": "categories",
    "answers":    "answers",
    "content":    "content",
}

def detect_shape(schedule: dict) -> tuple[str, Any]:
    """Return (shape_name, data_collection) for a schedule dict."""
    for shape, key in SHAPE_KEYS.items():
        if key in schedule:
            return shape, schedule[key]
    return "unknown", None

def schedule_summary(sid: str, sched: dict) -> dict:
    shape, data = detect_shape(sched)
    count = len(data) if isinstance(data, (list, dict)) else 0
    return {
        "schedule_id": sid,
        "shape": shape,
        "count": count,
        "revision": sched.get("revision", {}),
    }

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="STB R-1 API",
    description=(
        f"Auto-generated REST API for STB Form R-1 canonical JSON. "
        f"Carrier: {ENVELOPE.get('respondent', {}).get('reporting_mark', '?')}  |  "
        f"Year: {ENVELOPE.get('form_metadata', {}).get('report_year', '?')}"
    ),
    version="1.0.0",
)

# ---------------------------------------------------------------------------
# Root
# ---------------------------------------------------------------------------

@app.get("/", tags=["Meta"])
def root():
    """API overview and available schedule list."""
    meta = ENVELOPE.get("form_metadata", {})
    respondent = ENVELOPE.get("respondent", {})
    return {
        "api": "STB R-1",
        "carrier": respondent.get("reporting_mark"),
        "carrier_name": respondent.get("legal_name"),
        "report_year": meta.get("report_year"),
        "submission_id": meta.get("submission_id"),
        "schedules_available": sorted(SCHEDULES.keys()),
        "docs": "/docs",
    }

# ---------------------------------------------------------------------------
# Submission / Envelope
# ---------------------------------------------------------------------------

@app.get("/submission", tags=["Submission"])
def get_submission():
    """Full submission envelope (metadata, respondent, officer, verification)."""
    return ENVELOPE

@app.get("/submission/metadata", tags=["Submission"])
def get_metadata():
    return ENVELOPE.get("form_metadata", {})

@app.get("/submission/respondent", tags=["Submission"])
def get_respondent():
    return ENVELOPE.get("respondent", {})

@app.get("/submission/officer", tags=["Submission"])
def get_officer():
    return ENVELOPE.get("officer_in_charge", {})

@app.get("/submission/verification", tags=["Submission"])
def get_verification():
    return ENVELOPE.get("verification", {})

# ---------------------------------------------------------------------------
# Footnotes
# ---------------------------------------------------------------------------

@app.get("/footnotes", tags=["Footnotes"])
def get_footnotes():
    return {"count": len(FOOTNOTES), "footnotes": FOOTNOTES}

# ---------------------------------------------------------------------------
# Schedules — index
# ---------------------------------------------------------------------------

@app.get("/schedules", tags=["Schedules"])
def list_schedules(shape: Optional[str] = Query(None, description="Filter by shape: rows|items|sections|categories|answers")):
    """List all schedules with shape type and record count."""
    summaries = [schedule_summary(sid, sched) for sid, sched in SCHEDULES.items()]
    if shape:
        summaries = [s for s in summaries if s["shape"] == shape]
    return {"count": len(summaries), "schedules": summaries}

# ---------------------------------------------------------------------------
# Schedule — full
# ---------------------------------------------------------------------------

@app.get("/schedules/{schedule_id}", tags=["Schedules"])
def get_schedule(schedule_id: str):
    """Full schedule including revision and all data."""
    sched = SCHEDULES.get(schedule_id)
    if sched is None:
        raise HTTPException(404, f"Schedule '{schedule_id}' not found. Available: {sorted(SCHEDULES.keys())}")
    return sched

@app.get("/schedules/{schedule_id}/revision", tags=["Schedules"])
def get_schedule_revision(schedule_id: str):
    sched = _get_or_404(schedule_id)
    return sched.get("revision", {})

# ---------------------------------------------------------------------------
# Schedule — data (shape-aware)
# ---------------------------------------------------------------------------

@app.get("/schedules/{schedule_id}/data", tags=["Data"])
def get_schedule_data(
    schedule_id: str,
    line_no: Optional[int] = Query(None, description="Filter by line_no"),
    title: Optional[str] = Query(None, description="Substring match on title field (case-insensitive)"),
    section_id: Optional[str] = Query(None, description="Filter by section_id (sections shape only)"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    """
    Return the data collection for a schedule with optional filtering.
    Shape-aware: handles rows, items, sections, categories, and answers.
    """
    sched = _get_or_404(schedule_id)
    shape, data = detect_shape(sched)

    # ---- answers / content: no pagination, return as-is ----
    if shape in ("answers", "content", "unknown"):
        return {"schedule_id": schedule_id, "shape": shape, "data": data}

    # ---- sections: flatten or filter by section_id ----
    if shape == "sections":
        if section_id:
            data = [s for s in data if str(s.get("section_id")) == section_id]
        if line_no is not None:
            # flatten lines across sections and find by line_no
            flat = []
            for section in data:
                for line in section.get("lines", []):
                    if line.get("line_no") == line_no:
                        flat.append({"section_id": section.get("section_id"), **line})
            return {"schedule_id": schedule_id, "shape": shape, "count": len(flat), "data": flat}
        # Return paginated sections
        total = len(data)
        page = data[offset: offset + limit]
        return {
            "schedule_id": schedule_id,
            "shape": shape,
            "total": total,
            "offset": offset,
            "limit": limit,
            "data": page,
        }

    # ---- rows / items / categories: list of dicts ----
    records = list(data)  # copy

    if line_no is not None:
        records = [r for r in records if r.get("line_no") == line_no]

    if title is not None:
        needle = title.lower()
        records = [r for r in records if needle in str(r.get("title", "")).lower()]

    total = len(records)
    page = records[offset: offset + limit]
    return {
        "schedule_id": schedule_id,
        "shape": shape,
        "total": total,
        "offset": offset,
        "limit": limit,
        "data": page,
    }


@app.get("/schedules/{schedule_id}/data/{line_no}", tags=["Data"])
def get_schedule_line(schedule_id: str, line_no: int):
    """
    Return a single record by line_no.
    Works for rows, items, and categories shapes.
    For sections, returns all lines matching line_no across all sections.
    """
    sched = _get_or_404(schedule_id)
    shape, data = detect_shape(sched)

    if shape in ("answers", "content", "unknown"):
        raise HTTPException(400, f"Schedule {schedule_id} has shape '{shape}' — use /schedules/{schedule_id}/data instead")

    if shape == "sections":
        results = []
        for section in data:
            for line in section.get("lines", []):
                if line.get("line_no") == line_no:
                    results.append({"section_id": section.get("section_id"), **line})
        if not results:
            raise HTTPException(404, f"line_no={line_no} not found in schedule {schedule_id}")
        return {"schedule_id": schedule_id, "line_no": line_no, "matches": results}

    match = next((r for r in data if r.get("line_no") == line_no), None)
    if match is None:
        raise HTTPException(404, f"line_no={line_no} not found in schedule {schedule_id}")
    return {"schedule_id": schedule_id, **match}

# ---------------------------------------------------------------------------
# Cross-schedule helpers
# ---------------------------------------------------------------------------

@app.get("/search/title", tags=["Search"])
def search_by_title(
    q: str = Query(..., description="Title substring to search (case-insensitive)"),
    schedule_id: Optional[str] = Query(None, description="Limit search to one schedule"),
):
    """Full-text search across all schedule titles/line descriptions."""
    needle = q.lower()
    results = []
    target_schedules = {schedule_id: SCHEDULES[schedule_id]} if schedule_id else SCHEDULES

    for sid, sched in target_schedules.items():
        if sid not in SCHEDULES:
            raise HTTPException(404, f"Schedule '{schedule_id}' not found")
        shape, data = detect_shape(sched)
        if shape in ("answers", "content", "unknown") or data is None:
            continue

        if shape == "sections":
            # Flatten lines from all sections
            for section in data:
                for line in section.get("lines", []):
                    title = line.get("title", "")
                    if needle in str(title).lower():
                        results.append({
                            "schedule_id": sid,
                            "section_id": section.get("section_id"),
                            "line_no": line.get("line_no"),
                            "title": title,
                        })
        else:
            records = data if isinstance(data, list) else []
            for r in records:
                title = r.get("title", "")
                if needle in str(title).lower():
                    results.append({"schedule_id": sid, "line_no": r.get("line_no"), "title": title})

    return {"query": q, "count": len(results), "results": results}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_or_404(schedule_id: str) -> dict:
    sched = SCHEDULES.get(schedule_id)
    if sched is None:
        raise HTTPException(404, f"Schedule '{schedule_id}' not found. Available: {sorted(SCHEDULES.keys())}")
    return sched
