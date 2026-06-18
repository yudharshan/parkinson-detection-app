# NeuroTrack ML Service — Parkinson's Motor-Symptom Monitoring

A research prototype that turns raw phone-sensor tests (a finger-tapping test and a
hold-still tremor test) into a per-session "symptom score" a clinician can track over
time. **This is a proof-of-concept, not a diagnostic device** — see *Limitations* below,
which is the most important section in this file.

```
raw sensor JSON ──▶ feature extractor (features.py) ──▶ ensemble model ──▶ {label, unhealthy_score}
                                                                                    │
                                              per session: mean of available tests ─┘ ──▶ plotted over time
```

## Data

Source: the [mPower](https://www.synapse.org/#!Synapse:syn4993293) study (Sage Bionetworks).
We use 20 real patient sessions per test type:

- **Tapping** — `tapping_results.json.TappingSamples` events `{TapTimeStamp, TappedButtonId, TapCoordinate}`.
- **Tremor** — the **rest (stand-still) segment** of the walking test
  (`accel_walking_rest.json.items`, raw accelerometer `{x,y,z,timestamp}` ~100 Hz, 30 s).
  This is genuinely the "hold the phone still" signal we want — not a workaround.

The tapping and tremor sets are **disjoint patients** (0 healthCode overlap), so the two
models are trained independently and the combined per-session score is only ever formed
live in the app.

## Files

| File | Role |
|---|---|
| `features.py` | **Single source of truth** for feature extraction. Imported by both training and serving so they cannot drift. |
| `dataio.py` | Loads CSVs and matches each row to its raw JSON file. |
| `analyze.py` | Per-file verification, feature distributions, class-separation analysis. |
| `train.py` | Builds tables, LOPO evaluation, CTGAN augmentation, trains, packages pkls, train/serve test. |
| `model_bundle.py` | Picklable ensemble wrapper; `predict()` returns label + continuous score. |
| `main.py` | FastAPI service loading the 4 pkls. |
| `*_feature_extractor.pkl`, `*_model.pkl` | The shipped artifacts. |

## Run

```bash
pip install -r requirements.txt
python analyze.py     # inspect data + separation (optional)
python train.py       # rebuild all 4 .pkl artifacts
uvicorn main:app --reload   # serve on :8000
```

## Features

**Tapping (10):** `total_taps, tap_rate, miss_rate, mean_tap_interval, std_tap_interval,
max_freeze_gap, reaction_time, alternation_rate, sequence_effect_slope, test_duration`.
**Tremor (4):** `tremor_power, tremor_rms, dominant_freq, tremor_power_ratio` — Welch PSD
on the gravity-removed magnitude signal, 4–6 Hz Parkinsonian band, sampling rate measured
from the actual timestamps (not assumed).

## Labels

There is **no clinical PD diagnosis** in this data — only self-reported medication timing
(`medTimepoint`). The binary label is therefore a *proxy*, used only at training time:

| medTimepoint | label | why |
|---|---|---|
| I don't take Parkinson medications | 0 | unambiguous control |
| Just after PD med (at your best) | 0 | medicated, near-best motor state; behaves like healthy in the data |
| Immediately before PD med | 1 | off-medication, worst motor state |
| Another time | 1 | ambiguous; set to 1 to keep classes trainable (dropping it leaves tapping 11:1) |

> A previous version mislabeled "at your best" as 1 (PD). That inverted the model and gave
> healthy inputs only ~0.30 confidence. The mapping above is the fix.

## Output shape

```json
{ "label": 0, "prediction": "healthy", "unhealthy_score": 0.25, "confidence": 0.75 }
```
`unhealthy_score` ∈ [0,1] is the number plotted over time. `/session` returns per-test
results plus a combined score (mean of whichever tests were taken).

## Evaluation (honest)

Reported as **leave-one-patient-out** on the 20 real patients (majority-class baseline = 0.55):

| Model | LOPO accuracy | Reading |
|---|---|---|
| Tapping | **0.65** | Modest real signal in the clinically-correct direction (slower/fewer taps → unhealthy). |
| Tremor | **0.45** | **Does not generalize** — below baseline; resting-tremor signal is too faint in this sample. |

In-sample accuracy is ~19–20/20 for both — the gap vs LOPO is the overfitting you'd expect
at n=20, which is exactly why LOPO is the number we trust. CTGAN augmentation did **not**
improve LOPO (it can't add signal that isn't in the 20 real patients).

## Limitations (read this before trusting any number)

1. **Proxy labels, not diagnosis.** The model predicts medication-timing-derived state, not
   verified Parkinson's. A "perfect" score here would still not be a PD detector.
2. **n = 20 per test.** Tiny. The symptomatic tapping group is effectively 1 severe patient.
   Treat all metrics as directional, not validated.
3. **Tremor model is not usable as-is** (LOPO < baseline). Tapping carries the real signal.
4. **No paired data.** Tapping and tremor are different people, so the combined session score
   is untested on real patients.
5. **`miss_rate` is partly an artifact** (`TappedButtonNone` ranges 0–55% across files and looks
   like a logging quirk, not pure targeting error).
6. **Tremor score offset is currently disabled** (`main.py`, `TREMOR_OFFSET = 0.0` → raw model output).
   The tremor model is weak and reads high even for near-still inputs (a still phone is
   out-of-distribution vs the standing-still training data). A `TREMOR_OFFSET` knob exists to
   recenter the displayed score, but it trades away separation between healthy and symptomatic
   tremor, so it's left at 0. Tapping remains the reliable signal.

## Future work

Collect real PD-diagnosed labels and repeat tests per patient (to validate the over-time
trend, which is the app's actual purpose); revisit the tremor features (or drop the tremor
test) once more rest-tremor data exists; replace the `Another time` assumption with real labels.
