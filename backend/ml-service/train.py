"""
train.py — end-to-end training, honest evaluation, and artifact packaging.

Steps:
  1. Build real feature tables (via features.py — the SAME code the API uses).
  2. Honest leave-one-patient-out (LOPO) evaluation on the real 20:
       - real-only training  (most honest generalization estimate)
       - +augmentation        (shows the augmentation effect, leakage-free per fold)
  3. Final models trained on all real + CTGAN synthetic (~1000/test type),
     with a real-vs-synthetic distribution sanity check.
  4. Package the 4 .pkl artifacts and run a train/serve consistency test.

Run:  python train.py
"""

import os
import warnings

import numpy as np
import pandas as pd
import cloudpickle
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import SVC

import dataio
import features as features_mod
import model_bundle
from features import (
    extract_tapping_features, extract_tremor_features,
    TAPPING_FEATURES, TREMOR_FEATURES,
    TappingFeatureExtractor, TremorFeatureExtractor,
)
from model_bundle import EnsembleModel

warnings.filterwarnings("ignore")
BASE = os.path.dirname(os.path.abspath(__file__))
RNG = np.random.default_rng(0)
TARGET_TOTAL = 1000  # synthetic + real per test type

# Locked label mapping (see analyze.py evidence + README).
LABEL_MAP = {
    "I don't take Parkinson medications": 0,
    "Just after Parkinson medication (at your best)": 0,
    "Immediately before Parkinson medication": 1,
    "Another time": 1,
}


def build_table(records, extractor, feat_names):
    X, y, hc = [], [], []
    for r in records:
        if not r["matched"]:
            continue
        f = extractor(r["raw"])
        X.append([f[k] for k in feat_names])
        y.append(LABEL_MAP[r["medTimepoint"]])
        hc.append(r["healthCode"])
    return np.array(X, float), np.array(y, int), hc


# --------------------------- augmentation ---------------------------
def augment_gaussian(X, y, per_class):
    """Per-class multivariate Gaussian sampling, clipped to the real range.
    Fast + stable at tiny n — used in LOPO folds and as the CTGAN fallback."""
    outX, outY = [X], [y]
    for c in np.unique(y):
        Xc = X[y == c]
        if len(Xc) == 0:
            continue
        mu = Xc.mean(0)
        cov = np.cov(Xc, rowvar=False) if len(Xc) > 1 else np.zeros((X.shape[1], X.shape[1]))
        cov = np.atleast_2d(cov) + np.eye(X.shape[1]) * 1e-9
        n = max(0, per_class - len(Xc))
        if n:
            s = RNG.multivariate_normal(mu, cov, size=n)
            s = np.clip(s, Xc.min(0), Xc.max(0))
            outX.append(s)
            outY.append(np.full(n, c))
    return np.vstack(outX), np.concatenate(outY)


def augment_ctgan(X, y, feat_names, target_total):
    """CTGAN on the real feature+label table; returns (X_full, y_full, synth_df)."""
    from ctgan import CTGAN
    df = pd.DataFrame(X, columns=feat_names)
    df["label"] = y
    ctgan = CTGAN(epochs=300, verbose=False)
    ctgan.fit(df, discrete_columns=["label"])
    need = max(0, target_total - len(df))
    synth = ctgan.sample(need)
    # clip synthetic features to the real observed range (no impossible values)
    for col in feat_names:
        synth[col] = synth[col].clip(df[col].min(), df[col].max())
    full = pd.concat([df, synth], ignore_index=True)
    return full[feat_names].values, full["label"].values.astype(int), synth


# --------------------------- training ---------------------------
def train_ensemble(X, y, feat_names):
    scaler = StandardScaler().fit(X)
    Xs = scaler.transform(X)
    rf = RandomForestClassifier(n_estimators=200, random_state=0,
                                class_weight="balanced").fit(Xs, y)
    svm = SVC(probability=True, kernel="rbf", class_weight="balanced",
              random_state=0).fit(Xs, y)
    return EnsembleModel(scaler, rf, svm, feat_names)


def lopo(X, y, hc, feat_names, per_class=None):
    """Leave-one-patient-out. per_class=None -> real-only training (no synthetic)."""
    preds = []
    patients = list(dict.fromkeys(hc))
    hc = np.array(hc)
    for p in patients:
        te = hc == p
        Xtr, ytr, Xte, yte = X[~te], y[~te], X[te], y[te]
        if len(np.unique(ytr)) < 2:
            continue
        if per_class:
            Xtr, ytr = augment_gaussian(Xtr, ytr, per_class)
        m = train_ensemble(Xtr, ytr, feat_names)
        for xi, yi in zip(Xte, yte):
            o = m.predict(xi.reshape(1, -1))
            preds.append((p[:8], int(yi), o["label"], o["unhealthy_score"]))
    acc = np.mean([a == b for _, a, b, _ in preds]) if preds else float("nan")
    return acc, preds


def sanity_check(name, X, y, Xsyn, feat_names):
    print(f"\n--- {name}: real vs synthetic distribution check ---")
    print(f"{'feature':<22}{'real_mean':>12}{'syn_mean':>12}{'real_std':>12}{'syn_std':>12}")
    for i, f in enumerate(feat_names):
        print(f"{f:<22}{X[:,i].mean():>12.4f}{Xsyn[:,i].mean():>12.4f}"
              f"{X[:,i].std():>12.4f}{Xsyn[:,i].std():>12.4f}")


def run(name, records, extractor, feat_names):
    print("\n" + "#" * 90 + f"\n# {name.upper()}\n" + "#" * 90)
    X, y, hc = build_table(records, extractor, feat_names)
    print(f"real rows: {len(y)}  labels: 0(healthy)={np.sum(y==0)}  1(unhealthy)={np.sum(y==1)}")

    acc_real, p_real = lopo(X, y, hc, feat_names, per_class=None)
    acc_aug, _ = lopo(X, y, hc, feat_names, per_class=50)
    print(f"\nLOPO accuracy  real-only: {acc_real:.2f}   +augmentation: {acc_aug:.2f}   (n={len(p_real)})")
    print("per-patient (real-only LOPO):  hc      true  pred  score")
    for hc8, t, pr, sc in p_real:
        mark = "" if t == pr else "   <-- WRONG"
        print(f"   {hc8}   {t}     {pr}    {sc:.2f}{mark}")

    # final model: CTGAN-augmented
    try:
        Xf, yf, synth_df = augment_ctgan(X, y, feat_names, TARGET_TOTAL)
        method = "CTGAN"
        Xsyn = synth_df[feat_names].values
    except Exception as e:
        print(f"\n[CTGAN unavailable: {type(e).__name__}: {e}] -> Gaussian-copula fallback")
        Xf, yf = augment_gaussian(X, y, TARGET_TOTAL // 2)
        method = "Gaussian"
        Xsyn = Xf[len(y):]
    print(f"\nfinal training set: {len(yf)} rows ({method}-augmented)  "
          f"0={np.sum(yf==0)} 1={np.sum(yf==1)}")
    sanity_check(name, X, y, Xsyn, feat_names)

    model = train_ensemble(Xf, yf, feat_names)

    # predictions on the 20 REAL rows (in-sample sanity, not generalization)
    print(f"\n{name} final-model predictions on the 20 REAL rows (in-sample sanity):")
    print("   hc        true  pred  unhealthy_score")
    for xi, yi, h in zip(X, y, hc):
        o = model.predict(xi.reshape(1, -1))
        mark = "" if o["label"] == yi else "   <-- WRONG"
        print(f"   {h[:8]}   {yi}     {o['label']}    {o['unhealthy_score']:.2f}{mark}")

    return X, y, model


def main():
    cloudpickle.register_pickle_by_value(features_mod)
    cloudpickle.register_pickle_by_value(model_bundle)

    Xt, yt, tap_model = run("tapping", dataio.load_tapping(),
                            extract_tapping_features, TAPPING_FEATURES)
    Xr, yr, trem_model = run("tremor", dataio.load_tremor(),
                             extract_tremor_features, TREMOR_FEATURES)

    # ---- package artifacts ----
    arts = {
        "tapping_feature_extractor.pkl": TappingFeatureExtractor(),
        "tremor_feature_extractor.pkl": TremorFeatureExtractor(),
        "tapping_model.pkl": tap_model,
        "tremor_model.pkl": trem_model,
    }
    for fname, obj in arts.items():
        with open(os.path.join(BASE, fname), "wb") as f:
            cloudpickle.dump(obj, f)
    print("\nSaved artifacts:", ", ".join(arts))

    # ---- train/serve consistency test ----
    print("\n=== TRAIN/SERVE CONSISTENCY (extractor pkl reloaded, on 2 real raw files) ===")
    with open(os.path.join(BASE, "tapping_feature_extractor.pkl"), "rb") as f:
        tap_ext = cloudpickle.load(f)
    tap = dataio.load_tapping()
    for r in tap[:2]:
        train_path = np.array([[extract_tapping_features(r["raw"])[k] for k in TAPPING_FEATURES]])
        serve_path = tap_ext.transform(r["raw"])
        ok = np.allclose(train_path, serve_path)
        print(f"   {r['healthCode'][:8]} tapping: match={ok}")


if __name__ == "__main__":
    main()
