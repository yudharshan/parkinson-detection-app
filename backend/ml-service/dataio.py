"""
dataio.py — load the real dataset and match each CSV row to its raw JSON file.

The CSV reference cells contain the FULL .tmp filename (verified), so matching is an
exact basename lookup in datasets/. Tapping and tremor are DISJOINT patient sets
(0 healthCode overlap), so they are loaded independently.

Tremor source = accel_walking_rest rest-segment files (the patient standing still
after the walk), raw accelerometer {x,y,z,timestamp} including gravity.
"""

import csv
import json
import os

_BASE = os.path.dirname(os.path.abspath(__file__))
_REPO = os.path.dirname(os.path.dirname(_BASE))
DATASETS = os.path.join(_REPO, "datasets")

TAPPING_CSV = os.path.join(DATASETS, "tapping_cleaned_final.csv")
TREMOR_CSV = os.path.join(DATASETS, "walking_rest_cleaned_final.csv")

TAPPING_REF = "tapping_results.json.TappingSamples"
TREMOR_REF = "accel_walking_rest.json.items"


def _load_json(filename):
    path = os.path.join(DATASETS, filename)
    if not os.path.exists(path):
        return None
    with open(path) as f:
        return json.load(f)


def _load(csv_path, ref_col):
    records = []
    with open(csv_path, newline="") as f:
        for i, row in enumerate(csv.DictReader(f), 1):
            fname = (row.get(ref_col) or "").strip()
            raw = _load_json(fname)
            records.append({
                "idx": i,
                "healthCode": row["healthCode"],
                "medTimepoint": row["medTimepoint"].strip(),
                "phoneInfo": row.get("phoneInfo", "").strip(),
                "file": fname,
                "raw": raw,
                "matched": raw is not None,
            })
    return records


def load_tapping():
    return _load(TAPPING_CSV, TAPPING_REF)


def load_tremor():
    return _load(TREMOR_CSV, TREMOR_REF)
