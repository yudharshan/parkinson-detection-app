"""
main.py — FastAPI inference service.

Loads the 4 packaged artifacts and serves predictions. Feature extraction is NOT
re-implemented here — it is loaded from the same feature-extractor pkls that were
built from features.py, so the serving path is byte-for-byte the training path.
(The previous version of this file hardcoded the tremor features to [10,2.5,5,0.7]
for every patient — that train/serve mismatch is what this rewrite removes.)

Endpoints:
  POST /predict/tapping  {"samples": [ {TapTimeStamp,TappedButtonId,TapCoordinate}, ... ]}
  POST /predict/tremor   {"samples": [ {x,y,z,timestamp}, ... ]}
  POST /session          {"tapping": [...]?, "tremor": [...]?}  -> per-test + combined score
"""

import os
from typing import Any, Dict, List, Optional

import cloudpickle
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="NeuroTrack ML Service")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def _load(name):
    with open(os.path.join(BASE_DIR, name), "rb") as f:
        return cloudpickle.load(f)


try:
    TAP_EXTRACTOR = _load("tapping_feature_extractor.pkl")
    TREM_EXTRACTOR = _load("tremor_feature_extractor.pkl")
    TAP_MODEL = _load("tapping_model.pkl")
    TREM_MODEL = _load("tremor_model.pkl")
    print(f"[ok] Loaded extractors + models from {BASE_DIR}")
except FileNotFoundError as e:
    TAP_EXTRACTOR = TREM_EXTRACTOR = TAP_MODEL = TREM_MODEL = None
    print(f"[error] Missing artifact: {e.filename}. Run `python train.py` first.")


class Samples(BaseModel):
    samples: List[Dict[str, Any]]


class SessionPayload(BaseModel):
    tapping: Optional[List[Dict[str, Any]]] = None
    tremor: Optional[List[Dict[str, Any]]] = None


def _run_tapping(samples):
    out = TAP_MODEL.predict(TAP_EXTRACTOR.transform(samples))
    out["features"] = {k: round(float(v), 5) for k, v in TAP_EXTRACTOR.extract(samples).items()}
    return out


# Tremor score calibration (documented in README): the tremor model reads high even for a
# still hand, because a still phone has less motion than the standing-still training data
# (out-of-distribution). Per product decision we shift the tremor score down by a fixed
# baseline. This is a transparent recentering for the TREMOR test only — not a model fix.
TREMOR_OFFSET = 0.00  # no offset — raw model output (normal)

def _run_tremor(samples):
    out = TREM_MODEL.predict(TREM_EXTRACTOR.transform(samples))
    adj = max(0.0, min(1.0, out["unhealthy_score"] - TREMOR_OFFSET))
    out["unhealthy_score"] = round(adj, 4)
    out["label"] = int(adj >= 0.5)
    out["prediction"] = "unhealthy" if out["label"] else "healthy"
    out["confidence"] = round(max(adj, 1 - adj), 4)
    out["features"] = {k: round(float(v), 5) for k, v in TREM_EXTRACTOR.extract(samples).items()}
    return out


@app.post("/predict/tapping")
def predict_tapping(p: Samples):
    if not p.samples:
        raise HTTPException(400, "empty samples")
    return _run_tapping(p.samples)


@app.post("/predict/tremor")
def predict_tremor(p: Samples):
    if not p.samples:
        raise HTTPException(400, "empty samples")
    return _run_tremor(p.samples)


@app.post("/session")
def session(p: SessionPayload):
    """Combine whichever test(s) the patient took this session into ONE score.

    Combined score = mean of the available tests' unhealthy_score. If only one
    test was taken, that test's score stands alone (no forced average). This single
    number is what the app plots over time.
    """
    out: Dict[str, Any] = {}
    scores = []
    if p.tapping:
        out["tapping"] = _run_tapping(p.tapping)
        scores.append(out["tapping"]["unhealthy_score"])
    if p.tremor:
        out["tremor"] = _run_tremor(p.tremor)
        scores.append(out["tremor"]["unhealthy_score"])
    if not scores:
        raise HTTPException(400, "provide tapping and/or tremor samples")

    combined = sum(scores) / len(scores)
    out["session"] = {
        "unhealthy_score": round(combined, 4),
        "prediction": "unhealthy" if combined >= 0.5 else "healthy",
        "tests_taken": len(scores),
    }
    return out


@app.get("/health")
def health():
    return {"ok": TAP_MODEL is not None}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
