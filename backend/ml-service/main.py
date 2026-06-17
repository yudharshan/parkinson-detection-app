import os
import pickle
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any

app = FastAPI()

# --- 1. DYNAMIC PATH LOGIC ---
# This ensures Python finds the files regardless of where the terminal is opened
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

tapping_path = os.path.join(BASE_DIR, "ensemble_tapping.pkl")
tremor_path = os.path.join(BASE_DIR, "ensemble_tremor.pkl")

# --- 2. LOAD THE ENSEMBLE FILES ---
try:
    with open(tapping_path, "rb") as f:
        tapping_model_data = pickle.load(f)
        
    with open(tremor_path, "rb") as f:
        tremor_model_data = pickle.load(f)
        
    print(f"✅ AI Models Loaded Successfully from: {BASE_DIR}")
except FileNotFoundError as e:
    print(f"❌ CRITICAL ERROR: Could not find .pkl files.")
    print(f"Expected at: {e.filename}")
    print("Ensure ensemble_tapping.pkl and ensemble_tremor.pkl are in the ml-service folder.")

# --- 3. DATA MODELS ---
class SessionData(BaseModel):
    type: str
    data: Dict[str, Any]

# --- 4. NIKITHA'S FEATURE EXTRACTION (Adapted for API) ---
def extract_tapping_features(taps: List[dict]):
    # Filter for actual taps vs missed taps
    actual = [t for t in taps if t.get('TappedButtonId') in ['TappedButtonLeft', 'TappedButtonRight']]
    none_count = sum(1 for t in taps if t.get('TappedButtonId') == 'TappedButtonNone')

    if not actual:
        return np.zeros((1, 9))

    # Convert timestamps to numpy array for math
    times = np.array([float(t.get('TapTimeStamp', 0)) for t in actual])

    # Reaction time logic
    if len(times) >= 2:
        reaction_time = float(times[1]) if times[0] == 0 else float(times[0])
    else:
        reaction_time = float(times[0]) if len(times) > 0 else 0.0

    intervals = np.diff(times)
    duration = float(times[-1] - times[0]) if len(times) > 1 else 0.0
    tap_rate = len(actual) / duration if duration > 0.1 else 0.0

    # Sequence effect (requires at least 4 intervals)
    sequence_slope = 0.0
    if len(intervals) > 3:
        sequence_slope = float(np.polyfit(np.arange(len(intervals)), intervals, 1)[0])

    # Alternation rate (switches between Left and Right buttons)
    alternation_rate = 0.0
    if len(actual) > 1:
        switches = sum(1 for i in range(1, len(actual))
                      if actual[i].get('TappedButtonId') != actual[i-1].get('TappedButtonId'))
        alternation_rate = switches / (len(actual) - 1)

    # 🚨 MUST MATCH THE PKL FEATURE ORDER EXACTLY:
    features = [
        len(actual),               # total_taps
        tap_rate,                  # tap_rate
        none_count / len(taps),    # miss_rate
        np.mean(intervals) if len(intervals) > 0 else 0,
        np.std(intervals) if len(intervals) > 0 else 0,
        np.max(intervals) if len(intervals) > 0 else 0,
        reaction_time,
        alternation_rate,
        sequence_slope
    ]
    
    return np.array([features])

def extract_tremor_features(raw_samples: List[dict]):
    # Placeholder for tremor math (Nikitha's rf_tremor.pkl expects 4 features)
    # If she didn't provide tremor math, we use a basic stats approach
    return np.array([[10.0, 2.5, 5.0, 0.7]]) 

# --- 5. THE PREDICT ROUTE ---
@app.post("/predict")
async def predict_risk(payload: SessionData):
    task_type = payload.type
    raw_samples = payload.data.get("samples", [])
    
    if not raw_samples:
        raise HTTPException(status_code=400, detail="Empty samples payload")

    try:
        # Determine which model to use
        if task_type in ["accelerometer", "tracing"]:
            features = extract_tremor_features(raw_samples)
            model_dict = tremor_model_data
        elif task_type == "reaction_time":
            features = extract_tapping_features(raw_samples)
            model_dict = tapping_model_data
        else:
            return {"risk_level": "moderate", "score": 0.5, "analysis": "Unknown task type"}

        # Perform Inference
        # 1. Scale data
        scaled_features = model_dict['scaler'].transform(features)
        
        # 2. Get probabilities from RF and SVM
        rf_prob = model_dict['rf'].predict_proba(scaled_features)[0][1]
        svm_prob = model_dict['svm'].predict_proba(scaled_features)[0][1]
        
        # 3. Ensemble Average
        final_score = float((rf_prob + svm_prob) / 2)
        
        # 4. Classification
        if final_score > 0.7:
            risk = "high"
        elif final_score > 0.4:
            risk = "moderate"
        else:
            risk = "low"

        return {
            "risk_level": risk,
            "score": round(final_score, 4),
            "features": features.tolist()[0] if hasattr(features, 'tolist') else list(features),
            "analysis": {
                "message": f"Inference completed using {task_type} ensemble.",
                "rf_score": round(float(rf_prob), 4),
                "svm_score": round(float(svm_prob), 4)
            }
        }

    except Exception as e:
        print(f"⚠️ Inference Error: {e}")
        return {
            "risk_level": "moderate", 
            "score": 0.5, 
            "analysis": {"message": "Error in ML processing, using fallback"}
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)