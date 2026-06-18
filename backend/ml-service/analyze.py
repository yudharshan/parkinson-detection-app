"""
analyze.py — verification + feature distributions + class-separation go/no-go.

Run BEFORE any training. Prints:
  1. Per-file pass/fail/suspicious table for all 20 tapping + 20 tremor files.
  2. Full feature distributions across the 20 real files (with 0/degenerate flags).
  3. Class separation: unambiguous healthy (no meds) vs symptomatic (immediately
     before meds), and where the ambiguous groups ('Another time', 'at your best') fall.
"""

import numpy as np

import dataio
from features import (
    extract_tapping_features, extract_tremor_features, _sampling_rate,
    TAPPING_FEATURES, TREMOR_FEATURES, ACTUAL_BUTTONS,
)


def verify_tapping(rec):
    taps = rec["raw"] or []
    flags = []
    n = len(taps)
    actual = [t for t in taps if t.get("TappedButtonId") in ACTUAL_BUTTONS]
    none_ct = sum(1 for t in taps if t.get("TappedButtonId") == "TappedButtonNone")
    other = set(t.get("TappedButtonId") for t in taps) - set(ACTUAL_BUTTONS) - {"TappedButtonNone"}
    ts = [float(t.get("TapTimeStamp", 0.0)) for t in taps]
    dur = (max(ts) - min(ts)) if ts else 0.0
    mono = all(ts[i] <= ts[i + 1] for i in range(len(ts) - 1)) if len(ts) > 1 else True

    if not (min(ts) <= 0.05 if ts else False):
        flags.append(f"start={min(ts):.2f}(not~0)" if ts else "empty")
    if not mono:
        flags.append("non-monotonic")
    if dur < 10 or dur > 30:
        flags.append(f"dur={dur:.1f}s")
    if len(actual) < 10:
        flags.append(f"low_taps={len(actual)}")
    if n and none_ct / n > 0.5:
        flags.append(f"miss%={100*none_ct/n:.0f}")
    if other:
        flags.append(f"badbtn={other}")

    status = "PASS" if not flags else ("SUSPECT" if len(actual) >= 3 else "FAIL")
    return dict(idx=rec["idx"], hc=rec["healthCode"][:8], med=rec["medTimepoint"][:18],
                n=n, taps=len(actual), miss=none_ct, dur=round(dur, 1),
                status=status, flags=";".join(flags))


def verify_tremor(rec):
    s = rec["raw"] or []
    flags = []
    n = len(s)
    if n < 8:
        return dict(idx=rec["idx"], hc=rec["healthCode"][:8], med=rec["medTimepoint"][:18],
                    n=n, dur=0, fs=0, status="FAIL", flags="too_few_samples")
    x = np.array([float(p.get("x", 0)) for p in s])
    y = np.array([float(p.get("y", 0)) for p in s])
    z = np.array([float(p.get("z", 0)) for p in s])
    t = np.array([float(p.get("timestamp", 0)) for p in s])
    dur = float(t[-1] - t[0])
    fs, ok = _sampling_rate(t)
    dt = np.diff(t)
    max_gap = float(np.max(dt)) if len(dt) else 0.0
    cv = float(np.std(dt) / np.mean(dt)) if len(dt) and np.mean(dt) else 0.0
    maxabs = float(max(np.max(np.abs(x)), np.max(np.abs(y)), np.max(np.abs(z))))
    mag = np.sqrt(x**2 + y**2 + z**2)
    # longest flat run (consecutive near-identical magnitude)
    flat = np.abs(np.diff(mag)) < 1e-6
    longest = 0
    cur = 0
    for v in flat:
        cur = cur + 1 if v else 0
        longest = max(longest, cur)
    flat_s = longest / fs if fs else 0.0

    if not ok:
        flags.append("bad_fs")
    if dur < 15 or dur > 45:
        flags.append(f"dur={dur:.1f}s")
    if max_gap > 0.5:
        flags.append(f"gap={max_gap:.2f}s")
    if cv > 0.5:
        flags.append(f"fs_cv={cv:.2f}")
    if maxabs > 10:
        flags.append(f"maxabs={maxabs:.1f}g")
    if flat_s > 1.0:
        flags.append(f"flat={flat_s:.1f}s")

    status = "PASS" if not flags else "SUSPECT"
    return dict(idx=rec["idx"], hc=rec["healthCode"][:8], med=rec["medTimepoint"][:18],
                n=n, dur=round(dur, 1), fs=round(fs, 1), status=status, flags=";".join(flags))


def print_table(title, rows, cols):
    print("\n" + "=" * 100)
    print(title)
    print("=" * 100)
    header = "".join(f"{c:>{w}}" for c, w in cols)
    print(header)
    print("-" * len(header))
    for r in rows:
        print("".join(f"{str(r[c]):>{w}}" for c, w in cols))


def dist_table(title, feats_by_name, names):
    print("\n" + "=" * 100)
    print(title)
    print("=" * 100)
    print(f"{'feature':<22}{'min':>12}{'median':>12}{'mean':>12}{'max':>12}{'#zeros':>8}")
    print("-" * 78)
    for name in names:
        vals = np.array([f[name] for f in feats_by_name])
        zeros = int(np.sum(vals == 0))
        flag = "  <-- ZEROS" if zeros else ""
        print(f"{name:<22}{vals.min():>12.4f}{np.median(vals):>12.4f}"
              f"{vals.mean():>12.4f}{vals.max():>12.4f}{zeros:>8}{flag}")


def separation(feats, meds, names, kind):
    print("\n" + "=" * 100)
    print(f"CLASS SEPARATION ({kind}): unambiguous healthy vs symptomatic")
    print("=" * 100)
    healthy = [f for f, m in zip(feats, meds) if m == "I don't take Parkinson medications"]
    sympt = [f for f, m in zip(feats, meds) if m == "Immediately before Parkinson medication"]
    best = [f for f, m in zip(feats, meds) if m == "Just after Parkinson medication (at your best)"]
    other = [f for f, m in zip(feats, meds) if m == "Another time"]
    print(f"n: healthy(no-meds)={len(healthy)}  symptomatic(before-meds)={len(sympt)}  "
          f"at-best={len(best)}  another-time={len(other)}")
    print(f"\n{'feature':<22}{'healthy_mean':>14}{'sympt_mean':>14}{'atbest_mean':>14}"
          f"{'another_mean':>14}{'sep(|d|/pool_sd)':>18}")
    print("-" * 96)

    def grp(g, name):
        return np.array([f[name] for f in g]) if g else np.array([0.0])

    for name in names:
        h, s = grp(healthy, name), grp(sympt, name)
        b, o = grp(best, name), grp(other, name)
        pooled_sd = np.sqrt((h.var() + s.var()) / 2) or 1e-9
        sep = abs(h.mean() - s.mean()) / pooled_sd
        star = " *" if sep > 0.8 else ""
        print(f"{name:<22}{h.mean():>14.4f}{s.mean():>14.4f}{b.mean():>14.4f}"
              f"{o.mean():>14.4f}{sep:>18.2f}{star}")
    print("\n(* = |Cohen's d| > 0.8, a 'large' effect — i.e. the feature visibly "
          "separates the two unambiguous groups even at n=20.)")


def main():
    # ---------------- TAPPING ----------------
    tap = dataio.load_tapping()
    print(f"\nTAPPING: loaded {len(tap)} rows, matched {sum(r['matched'] for r in tap)}")
    vt = [verify_tapping(r) for r in tap]
    print_table("TAPPING per-file verification", vt, [
        ("idx", 5), ("hc", 10), ("med", 20), ("n", 6), ("taps", 6),
        ("miss", 6), ("dur", 7), ("status", 9), ("flags", 30)])

    tap_feats = [extract_tapping_features(r["raw"]) for r in tap]
    tap_meds = [r["medTimepoint"] for r in tap]
    dist_table("TAPPING feature distributions (20 real files)", tap_feats, TAPPING_FEATURES)
    separation(tap_feats, tap_meds, TAPPING_FEATURES, "tapping")

    # ---------------- TREMOR ----------------
    trem = dataio.load_tremor()
    print(f"\n\nTREMOR: loaded {len(trem)} rows, matched {sum(r['matched'] for r in trem)}")
    vr = [verify_tremor(r) for r in trem]
    print_table("TREMOR per-file verification", vr, [
        ("idx", 5), ("hc", 10), ("med", 20), ("n", 7), ("dur", 7),
        ("fs", 7), ("status", 9), ("flags", 30)])

    trem_feats = [extract_tremor_features(r["raw"]) for r in trem]
    trem_meds = [r["medTimepoint"] for r in trem]
    dist_table("TREMOR feature distributions (20 real files)", trem_feats, TREMOR_FEATURES)
    separation(trem_feats, trem_meds, TREMOR_FEATURES, "tremor")


if __name__ == "__main__":
    main()
