"""
features.py — single source of truth for feature extraction.

Both the training pipeline (train.py) AND the live FastAPI service (main.py) import
the SAME functions from here. This is deliberate: the #1 risk in this project is the
training-time feature computation and the serving-time computation silently drifting
apart (e.g. the old serving code returned a hardcoded tremor vector [10, 2.5, 5, 0.7]
for every patient). By having exactly one implementation, train/serve parity is
guaranteed by construction, not by hoping two copies stay in sync.

Inputs are the raw device payloads, exactly as they arrive:
  - Tapping:  list of {"TapTimeStamp": float, "TappedButtonId": str, "TapCoordinate": str}
  - Tremor:   list of {"x": float, "y": float, "z": float, "timestamp": float}
              (accelerometer, raw, INCLUDING gravity — gravity is removed in here)

Everything here is pure and deterministic: same input -> same output.
"""

from __future__ import annotations

import numpy as np
from scipy.signal import welch

# numpy 2.x renamed trapz -> trapezoid; support both.
_trapz = getattr(np, "trapezoid", None) or np.trapz

# ---------------------------------------------------------------------------
# Fixed feature ordering. The model's scaler/classifier are trained on vectors
# in EXACTLY this order, so never reorder without retraining.
# ---------------------------------------------------------------------------
TAPPING_FEATURES = [
    "total_taps",
    "tap_rate",
    "miss_rate",
    "mean_tap_interval",
    "std_tap_interval",
    "max_freeze_gap",
    "reaction_time",
    "alternation_rate",
    "sequence_effect_slope",
    "test_duration",
]

TREMOR_FEATURES = [
    "tremor_power",
    "tremor_rms",
    "dominant_freq",
    "tremor_power_ratio",
]

ACTUAL_BUTTONS = ("TappedButtonLeft", "TappedButtonRight")

# Parkinsonian resting-tremor band (Hz) and the reference band used for the
# relative-power ratio. The ratio band deliberately excludes DC (<0.5 Hz, gravity
# leftovers) and high-frequency sensor noise.
TREMOR_BAND = (4.0, 6.0)
REFERENCE_BAND = (0.5, 12.0)
DOMINANT_SEARCH_BAND = (1.0, 15.0)


# ===========================================================================
# TAPPING
# ===========================================================================
def extract_tapping_features(taps):
    """Extract the 10 tapping features from a raw tap-event list.

    Returns a dict keyed by TAPPING_FEATURES. Degenerate inputs (no/one real tap)
    return zeros for the interval-derived features rather than crashing — the
    verification pass is responsible for flagging such files; the extractor must
    never throw on a single bad user test in production.
    """
    taps = taps or []
    actual = [t for t in taps if t.get("TappedButtonId") in ACTUAL_BUTTONS]
    none_count = sum(1 for t in taps if t.get("TappedButtonId") == "TappedButtonNone")
    total_events = len(taps)

    feats = {k: 0.0 for k in TAPPING_FEATURES}
    feats["total_taps"] = float(len(actual))
    feats["miss_rate"] = float(none_count / total_events) if total_events else 0.0

    if not actual:
        return feats

    times = np.sort(np.array([float(t.get("TapTimeStamp", 0.0)) for t in actual]))
    t_start = float(min(float(t.get("TapTimeStamp", 0.0)) for t in taps))  # global start (~0)

    # test_duration = span of actual taps (NOT a hardcoded 20s).
    duration = float(times[-1] - times[0]) if len(times) > 1 else 0.0
    feats["test_duration"] = duration
    feats["tap_rate"] = float(len(actual) / duration) if duration > 0.1 else 0.0

    # reaction_time: proxy for time-to-initiate the first deliberate tap, measured
    # from test start. There is no explicit "stimulus appeared" event in this data,
    # so this is an approximation, not a true stimulus-response reaction time.
    # TapTimeStamp starts at ~0, so if the very first actual tap IS the start
    # (rt == 0, physically implausible), fall back to the second tap.
    rt = float(times[0] - t_start)
    if rt == 0.0 and len(times) >= 2:
        rt = float(times[1] - t_start)
    feats["reaction_time"] = rt

    intervals = np.diff(times)
    if len(intervals) > 0:
        feats["mean_tap_interval"] = float(np.mean(intervals))
        feats["std_tap_interval"] = float(np.std(intervals))
        feats["max_freeze_gap"] = float(np.max(intervals))

    # sequence_effect_slope: slope of inter-tap interval vs tap index (PD sequence
    # effect = progressive slowing). Needs enough points to be meaningful.
    if len(intervals) > 3:
        feats["sequence_effect_slope"] = float(
            np.polyfit(np.arange(len(intervals)), intervals, 1)[0]
        )

    # alternation_rate: fraction of consecutive ACTUAL taps that switch button.
    # Misses (None) are dropped, so two real taps with a miss between them count
    # as adjacent. (Design choice; documented.)
    if len(actual) > 1:
        switches = sum(
            1 for i in range(1, len(actual))
            if actual[i].get("TappedButtonId") != actual[i - 1].get("TappedButtonId")
        )
        feats["alternation_rate"] = float(switches / (len(actual) - 1))

    return feats


# ===========================================================================
# TREMOR
# ===========================================================================
def _sampling_rate(timestamps):
    """Robust sampling rate (Hz) from the MEDIAN inter-sample delta.

    Median (not mean) so a few dropped samples / gaps don't skew fs. Returns
    (fs, ok) where ok is False if the rate cannot be trusted.
    """
    t = np.asarray(timestamps, dtype=float)
    if len(t) < 2:
        return 0.0, False
    dt = np.diff(t)
    dt = dt[dt > 0]
    if len(dt) == 0:
        return 0.0, False
    fs = 1.0 / float(np.median(dt))
    return fs, np.isfinite(fs) and fs > 0


def extract_tremor_features(samples, fs=None):
    """Extract the 4 frequency-domain tremor features from raw accel samples.

    samples: list of {"x","y","z","timestamp"} (raw accel, gravity included).
    fs:      optional override; if None, derived from the sample timestamps.

    Method (each step matters for correctness):
      1. magnitude = sqrt(x^2+y^2+z^2)  -> orientation-independent.
      2. remove gravity/DC by subtracting the mean -> isolate motion.
      3. Welch PSD at the measured fs.
      4. tremor_power = integrated PSD over 4-6 Hz; ratio vs 0.5-12 Hz reference.
      5. dominant_freq = peak frequency within 1-15 Hz (ignores DC / numerical noise).
    """
    samples = samples or []
    feats = {k: 0.0 for k in TREMOR_FEATURES}
    if len(samples) < 8:
        return feats

    x = np.array([float(s.get("x", 0.0)) for s in samples])
    y = np.array([float(s.get("y", 0.0)) for s in samples])
    z = np.array([float(s.get("z", 0.0)) for s in samples])
    t = np.array([float(s.get("timestamp", 0.0)) for s in samples])

    if fs is None:
        fs, ok = _sampling_rate(t)
        if not ok:
            return feats

    mag = np.sqrt(x ** 2 + y ** 2 + z ** 2)
    mag_ac = mag - np.mean(mag)  # gravity / DC removed

    # tremor_rms on the gravity-removed signal = motion energy, not gravity.
    feats["tremor_rms"] = float(np.sqrt(np.mean(mag_ac ** 2)))

    nperseg = int(min(len(mag_ac), 512))
    if nperseg < 16:
        return feats
    f, pxx = welch(mag_ac, fs=fs, nperseg=nperseg, detrend="constant")

    def band_power(lo, hi):
        m = (f >= lo) & (f <= hi)
        if not np.any(m):
            return 0.0
        return float(_trapz(pxx[m], f[m]))

    tremor_power = band_power(*TREMOR_BAND)
    ref_power = band_power(*REFERENCE_BAND)
    feats["tremor_power"] = tremor_power
    feats["tremor_power_ratio"] = float(tremor_power / ref_power) if ref_power > 0 else 0.0

    # dominant frequency within the physiological search band
    dm = (f >= DOMINANT_SEARCH_BAND[0]) & (f <= DOMINANT_SEARCH_BAND[1])
    if np.any(dm) and np.any(pxx[dm] > 0):
        feats["dominant_freq"] = float(f[dm][int(np.argmax(pxx[dm]))])

    return feats


# ===========================================================================
# Vector helpers + picklable extractor wrappers (the .pkl artifacts)
# ===========================================================================
def tapping_vector(feats):
    return np.array([[feats[k] for k in TAPPING_FEATURES]], dtype=float)


def tremor_vector(feats):
    return np.array([[feats[k] for k in TREMOR_FEATURES]], dtype=float)


class TappingFeatureExtractor:
    """Self-contained, picklable artifact: raw tap events -> ordered feature vector."""

    feature_names = TAPPING_FEATURES

    def extract(self, taps):
        return extract_tapping_features(taps)

    def transform(self, taps):
        return tapping_vector(self.extract(taps))


class TremorFeatureExtractor:
    """Self-contained, picklable artifact: raw accel samples -> ordered feature vector."""

    feature_names = TREMOR_FEATURES

    def extract(self, samples, fs=None):
        return extract_tremor_features(samples, fs=fs)

    def transform(self, samples, fs=None):
        return tremor_vector(self.extract(samples, fs=fs))
