# CLAUDE.md — Parkinson's Symptom Monitoring (Model & Data Work Only)

## Scope of this session

We are working ONLY on the data pipeline and ML model right now. Do not touch the Expo app, Node/Express backend, or FastAPI deployment code in this session unless explicitly asked. This file exists so you have full context before looking at any data or code.

This is a research project, not a finished clinical product. Be honest in your own reasoning and in anything you tell me — do not paper over uncertainty, do not assume the data means something it might not, and do not silently pick a convenient interpretation when the data is ambiguous. Ask me directly when something is unclear rather than guessing. I would rather slow down here than repeat a mistake we already made once (see "Known prior bug" below).

---

## How to work — ask, don't assume, treat this like research

Every decision point in this document that says "ask me" or "confirm with me" is not a formality — it is a hard requirement. If you find yourself about to make a judgment call on something ambiguous (a label mapping, a feature definition, whether a file looks corrupted vs genuinely impaired, which sampling rate to assume), stop and ask rather than picking the most convenient interpretation and moving forward. This project has already been damaged once by a silent wrong assumption (see "Known prior bug" below) — the cost of asking a clarifying question is a few minutes; the cost of a wrong silent assumption is retraining everything after it's already deployed somewhere.

Treat this like a research project, not a feature-shipping task: form a hypothesis about what the data shows, check it against evidence in the actual files, report what you found with your reasoning, and let me confirm or correct before treating it as settled. Don't optimize for finishing quickly — optimize for being right and for me understanding why each decision was made.

---

## Final deliverable — exact output format required

The end output of this entire pipeline must be a small set of `.pkl` files that I can load directly in FastAPI to serve predictions to the app backend. Specifically:

1. **`tapping_feature_extractor.pkl`** — takes raw tapping JSON (the array of `{TapTimeStamp, TappedButtonId, TapCoordinate}` events straight from the device) and outputs the engineered feature vector (`total_taps`, `tap_rate`, `miss_rate`, `mean_tap_interval`, `std_tap_interval`, `max_freeze_gap`, `reaction_time`, `alternation_rate`, `sequence_effect_slope`, `test_duration` — confirm this list doesn't change after the verification/validation work above). This must be a self-contained, loadable artifact (e.g. a class instance or function bundle via pickle) — not just a saved DataFrame of already-extracted features. It needs to run on a NEW patient's raw test data at inference time, not just reproduce the training set.

   **Important risk to actively guard against:** the function used to extract features for TRAINING (run once over the 20 real + ~1000 synthetic rows to build the training table) and the function packaged into this pkl for LIVE inference on a brand new single test must compute features in EXACTLY the same way. It's easy for these to drift apart without anyone noticing — e.g. the training script hardcodes an assumption like "this CSV column is already a parsed list" while the live pkl needs to parse a raw JSON string from the API first, or the training script silently drops a malformed row while the live version has to handle it gracefully instead of crashing on a single user's bad test. Before finalizing, explicitly confirm: is the pkl using the literal same function/code path as whatever computed the training features, or a separately written version that's supposed to do the same thing? If it's a separate version, that's a real risk of train/serve mismatch — flag it to me explicitly rather than assuming "it should produce the same output" without testing it side-by-side on at least a couple of the real 20 files.

2. **`tremor_feature_extractor.pkl`** — same idea, takes raw accelerometer readings (`{x, y, z, timestamp}` array) from a new test and outputs the tremor feature vector (`tremor_power`, `tremor_rms`, `dominant_freq`, `tremor_power_ratio`). Same train/serve consistency warning applies here.

3. **The classification model(s)** — we previously discussed two separate models (tapping, tremor) combined at the app layer rather than one unified model, and that's still the working plan, but I'm not fully certain that's the best approach versus a single combined model. Don't just default to two models because that's what was discussed before — if you see something in the actual feature distributions or data overlap during your analysis that suggests one approach is clearly better, raise it as a question with your reasoning and let me decide. Whichever we land on, the output is either:
   - `tapping_model.pkl` + `tremor_model.pkl` (two separate models), OR
   - `combined_model.pkl` (one model taking both feature sets)

   Confirm with me before training, same as the medTimepoint mapping decision.

4. The model file(s) must take an engineered feature vector (the OUTPUT of step 1/2) and return both a binary classification (healthy/unhealthy) AND a continuous confidence score — not just the binary label — since the app needs both a final healthy-vs-unhealthy result and a score to plot on the patient's symptom-over-time graph. Confirm the exact output shape (dict structure, key names) with me before finalizing, so it lines up cleanly with whatever the FastAPI endpoint and Node backend expect to receive.

**Why this matters for the app:** the patient takes a test on their phone → raw sensor data goes to FastAPI → FastAPI loads the feature extractor pkl to engineer features from the raw data → FastAPI loads the model pkl to get healthy/unhealthy + confidence → that result gets stored over time → the app graphs confidence/severity across multiple tests AND shows the current healthy/unhealthy classification. Every pkl file needs to work correctly when called on a single new test's raw data, not just on the batch of 20 (or 1000 augmented) training rows — test this explicitly before considering any pkl file done.

---

## Known prior bug — read this before doing anything

We previously trained the tapping model with this label mapping:
```python
df_tapping['label'] = df_tapping['medTimepoint'].map({
    'Just after Parkinson medication (at your best)': 1,
    "I don't take Parkinson medications": 0,
    'Immediately before Parkinson medication': 1,
    'Another time': 1
})
```
This is backwards for "Just after Parkinson medication (at your best)" — that phrase describes a patient who IS on medication and AT THEIR BEST, which is the closest this dataset gets to a near-healthy state, not a PD-positive state. We had it labeled 1 (PD). This produced a model that gave healthy-looking tremor input (low tremor_power, low RMS) only a borderline ~0.30 "No PD" confidence instead of a confident healthy classification — the model had learned an inverted relationship with weak confidence everywhere, which is consistent with flipped labels, not random noise.

Do not repeat this. Before finalizing any label mapping, show me the category counts per medTimepoint value, your proposed mapping, and your reasoning for each category — and wait for confirmation before training anything on it.

---

## The core unresolved question — I need your help deciding this, not guessing

This dataset only has **self-reported medication timing** (medTimepoint), not a clinical PD diagnosis. There is no ground-truth "this patient has Parkinson's" column. So "binary classification" here is really a proxy: we are classifying medication-timing-derived patient state, not verified disease status. Be upfront about this limitation in your own analysis and in anything that gets surfaced to a doctor later.

Within that constraint, here's the live disagreement we need to resolve together:
- "Immediately before Parkinson medication" has only **1 patient** in the tapping dataset (more in tremor, but still thin) — too small to be a reliable standalone class
- "Just after Parkinson medication (at your best)" is closer to a healthy/good-motor-control state, not a disease state
- "Another time" is ambiguous — we don't know if those patients have PD or not, or how recently they took medication
- "I don't take Parkinson medications" is the only clearly unambiguous healthy-control label

**Your task before writing any training code:** inspect the actual category counts in both the tapping CSV and tremor CSV (they are NOT identical — tremor has more "Immediately before" patients than tapping), and then PROPOSE a label mapping with explicit reasoning for each of the 4 categories, including what you'd do with "Another time" (drop it? keep it as PD-positive? something else?). Present this to me as a clear question with your recommendation and reasoning, and wait for my confirmation before training anything. Do not default to keeping all 4 categories just because that's what existed before.

---

## Dataset architecture — what you're actually looking at

I will add CSV files and JSON sample files to the project directory. Here's what to expect, but verify everything yourself against the real files rather than trusting this description blindly, since I'm describing this from memory and could be wrong about specifics:

### The CSV(s)
Each row represents one test session for one patient and contains:
- Identity/metadata columns (`healthCode`, `phoneInfo`, `appVersion`, timestamps, `recordId`)
- `medTimepoint` — the self-reported medication timing string (4 categories, see above)
- One or more columns whose VALUE is not real data, but a reference ID pointing to a separate JSON file. For example, `tapping_results.json.TappingSamples` contains a number like `5397548`, which is the filename fragment of the actual JSON file holding that patient's tap-by-tap data — the CSV cell itself is just a pointer, not the data.

**Important — there appear to be MULTIPLE test types bundled into this export, not just tapping and tremor.** I've seen column/filename references suggesting a row can also contain:
- `accel_walking_rest.json.items-...` and `deviceMotion_walking_rest.json.items-...` — a walking/rest test with its own accelerometer AND device motion data
- `accel_tapping.json.items-...` — background accelerometer captured DURING the tapping test (not the tremor test)
- `tapping_results.json.TappingSamples-...` — the actual tap event data for the tapping test

I am not fully sure of the complete column list, what "device motion" specifically captures (it's likely gyroscope/attitude data in addition to raw acceleration, but confirm this from the actual data rather than assuming), or whether tremor test data lives in this same CSV or a separate one. **Do not assume — read the actual CSV headers and JSON file contents first, and tell me what you find before building any pipeline.** If anything is ambiguous after inspecting the real files, ask me directly.

### What we are actually using right now
For this project, we only care about two test types:
1. **Tapping test** — `tapping_results.json.TappingSamples` (the actual tap events: TapTimeStamp, TappedButtonId, TapCoordinate). The `accel_tapping.json.items` file (background accelerometer during tapping) is currently NOT used for feature extraction — confirm this is still the right call, or flag if you think it has value we're leaving on the table.
2. **Tremor test** — accelerometer readings (x, y, z, timestamp) captured while the patient holds the phone still. Confirm which CSV/column this actually lives in — it may not be the same export as the tapping data.

Any other test type present in the data (walking/rest, device motion, etc.) is OUT OF SCOPE for now. Flag if you find it, but do not build features for it unless asked.

---

## Feature extraction — current state

We have a tapping feature extractor already written (functions exist in the project, look for them rather than rewriting from scratch). It currently extracts: `total_taps`, `tap_rate`, `miss_rate`, `mean_tap_interval`, `std_tap_interval`, `max_freeze_gap`, `reaction_time`, `alternation_rate`, `sequence_effect_slope`, `test_duration`.

Validate this code against the real JSON structure before trusting it — check things like: does `reaction_time` make sense given how `TapTimeStamp` actually starts (does it really start at/near 0 for every file, or was that assumed?); does `alternation_rate` correctly detect Left→Right switching given the actual `TappedButtonId` string values in the real files (e.g. `"TappedButtonLeft"` vs `"TappedButtonRight"` vs `"TappedButtonNone"` — confirm exact casing/spelling from real data, don't assume).

Tremor feature extraction (`tremor_power`, `tremor_rms`, `dominant_freq`, `tremor_power_ratio`) — locate the existing code if present, or build it if not, but FFT/frequency-domain features are easy to get subtly wrong (wrong sampling rate assumption, wrong band limits for the 4–6Hz PD tremor band, not detrending before FFT). Walk through your math explicitly and show me the reasoning, don't just produce numbers.

---

## Verify the 20 real samples themselves — before trusting any feature extracted from them

We only have 20 real patient rows total. If even a few of these are corrupted, mislabeled, or structurally broken, every downstream step inherits that damage silently — the model, the CTGAN augmentation, the final combined score, all of it. Do not assume the raw data is clean just because it loads without throwing an error. A JSON file can parse perfectly and still be garbage (e.g. all timestamps identical, a test that lasted 2 seconds instead of 20, a file with 3 tap events total, accelerometer readings that are flat-lined because the sensor wasn't actually moving/recording).

For EACH of the 20 raw tapping JSON files and EACH of the 20 raw tremor/accelerometer files, check and report:

**For tapping JSON files:**
- Does `TapTimeStamp` actually start at or near 0, and increase monotonically? Flag any file where timestamps go backwards, repeat, or jump unrealistically.
- Does the test span roughly 20 seconds (the documented test duration)? Flag any file where the last timestamp minus the first is wildly off from 20s (e.g. 3s or 90s) — that suggests a truncated upload or a test that wasn't actually completed.
- Is `total_taps` (actual Left/Right taps, excluding None) a plausible number for 20 seconds of rapid alternating tapping? A healthy adult typically manages somewhere in the range of roughly 100+ taps in 20s — flag any file with suspiciously few (e.g. under 10) as possibly an incomplete or aborted test rather than a genuine slow/impaired result, and tell me which is more likely given the rest of that file's pattern (e.g. if there are only 5 taps spread evenly across 20s, that's a real slow result; if there are 5 taps all bunched in the first 2 seconds, that's a truncated/incomplete upload).
- Are `TappedButtonId` values actually limited to `"TappedButtonLeft"`, `"TappedButtonRight"`, `"TappedButtonNone"` — flag any unexpected value, typo, null, or different casing.
- Is there an unreasonable proportion of `"TappedButtonNone"` (e.g. >50%) — could indicate either a genuinely severely impaired patient OR a broken touch-coordinate calibration in that recording session. Don't assume which; flag it and tell me your best read with reasoning.

**For tremor/accelerometer files:**
- Do x, y, z values stay within a physically plausible range (gravity alone is ~1g on one axis when still; wildly large values like >10 in any axis for a "hold still" test suggest the phone was dropped, moved, or the file is corrupted, not a clean tremor reading).
- Is there a flat-lined section (identical or near-identical x/y/z across many consecutive timestamps) — could mean the sensor stopped recording partway through, which would make any FFT/frequency feature computed from it meaningless for the missing portion.
- Does the timestamp range correspond to roughly the documented test duration, same logic as tapping above.
- Check sampling rate consistency — compute the actual time deltas between consecutive accelerometer readings across the file. If the sampling rate is inconsistent or has large gaps, flag it, because frequency-domain features (dominant_freq, tremor_power) assume a roughly constant sampling rate and will silently produce wrong numbers if that assumption is violated.

**Output I need from this verification step:** a per-file pass/fail/suspicious table (20 rows for tapping, 20 rows for tremor) with a one-line reason for anything flagged, BEFORE you extract or trust any feature from a flagged file. If a file looks structurally broken rather than just "looks like a severe patient," tell me explicitly which you think it is and why, and ask whether to exclude it rather than silently dropping or silently keeping it.

**Specific past failure mode to actively check for — do not let this slip through again:** last time, a feature value (`reaction_time`) silently came out as `0` for some files, which is not a plausible real reaction time and almost certainly indicates a bug in the extraction logic or a genuinely degenerate input file, not a real measurement. Before doing ANY augmentation, explicitly print/show the full distribution of every extracted feature (`reaction_time` especially, but all of them) across all 20 real files, and flag any value that is exactly 0, exactly equal to another feature in a suspicious way, or sits way outside what's physically plausible for that feature. If you find a 0 (or any other suspicious constant), trace WHY it happened — is the underlying raw data genuinely degenerate (e.g. only one tap in the file, so there's no second timestamp to compute reaction time from), or is the extraction code doing something wrong (e.g. a fallback `else: return 0` that masks a real bug)? Tell me which it is before deciding whether to fix the code, exclude the file, or accept the 0 as a real (if unusual) value. Do not silently let a 0 (or any other suspicious value) flow into CTGAN — synthetic data trained on a few broken 0s will likely manufacture a cluster of fake "instant reaction time" patients that don't represent anything real.

I am also providing the raw dataset directly (not just samples) — some feature extraction work may already exist and may already be partially correct. Use what's there as a starting point to inspect, not as ground truth to build on top of unquestioned. Re-derive a couple of feature values by hand/independently for at least 2–3 real files and compare against whatever the existing extractor produces for those same files, to catch any subtle bug the existing code might have before we rely on it for all 20.

---

## Feature extraction — explained in detail, read carefully before touching this code

This section explains WHY each feature is computed the way it is, so you can judge whether the existing code computes it correctly, rather than just checking that it runs without crashing.

### Tapping features — what each one means clinically and how it should be computed

**`total_taps`** — count of tap events where `TappedButtonId` is `"TappedButtonLeft"` or `"TappedButtonRight"` (exclude `"TappedButtonNone"` — those are misses, not taps on a button). This measures overall motor output volume in the 20s window. Lower than expected = possible bradykinesia (slowness) — but per the verification step above, also possibly a truncated recording, so cross-check against test duration before interpreting clinically.

**`tap_rate`** — `total_taps / test_duration`, where `test_duration` is the actual elapsed time in that recording (last timestamp − first timestamp), NOT a hardcoded 20. Using the actual recorded duration matters because if a file's real span is 18.3s rather than exactly 20.0s, dividing by the wrong constant skews the rate. Watch for division by a near-zero duration (guard against this, don't let it produce inf/NaN silently).

**`miss_rate`** — proportion of ALL recorded events (including None) where `TappedButtonId == "TappedButtonNone"`. This measures targeting accuracy / dysmetria. Confirm the denominator is the FULL event count (taps + misses), not just the actual-taps count — a miss rate calculated against the wrong denominator will be systematically wrong.

**`mean_tap_interval`** and **`std_tap_interval`** — computed from `np.diff(times)` where `times` is the sorted array of timestamps for ACTUAL taps only (not misses — misses don't represent a completed tap-to-tap motor cycle in the same way, though if the existing code includes misses in this calculation, flag that as a design choice to confirm with me rather than assuming it's wrong). Mean interval is the core bradykinesia signal (slower = higher mean interval). Std interval captures consistency/rhythm — high variability can indicate motor control instability even if the average looks normal.

**`max_freeze_gap`** — the single largest value in that same interval array. This is specifically trying to catch a motor freeze (a sudden multi-second halt in an otherwise fast-tapping sequence). Sanity check: if `max_freeze_gap` is large because the WHOLE file has sparse, evenly-spaced taps (e.g. a genuinely slow patient tapping once per second throughout), that is different from one anomalous huge gap in an otherwise fast sequence (a genuine freeze event). The raw number alone can't distinguish these — consider whether the extractor should also report something like `max_freeze_gap` relative to `mean_tap_interval` (a ratio) so a true outlier freeze is distinguishable from uniformly slow tapping. Flag this as a possible improvement rather than assuming the current single-number version is sufficient.

**`reaction_time`** — this one needs the most scrutiny. The existing code's logic ("if first tap is at time 0, use the second tap's timestamp as a reaction-time proxy, otherwise use the first tap's timestamp") is a workaround assumption, not a directly measured reaction time — there's no recorded "stimulus appeared at time X" event in this data structure, so any reaction-time feature here is an approximation of how long the patient took to initiate tapping after the test started, not a true stimulus-response reaction time. Verify: does `TapTimeStamp` reliably start at exactly 0.0 for the first event across the real files, or does it vary (e.g. starting at small nonzero values)? If it varies, the conditional logic in the existing code may behave inconsistently across files. Check this against the actual 20 real files and report what you find before deciding whether the current approach is acceptable or needs adjusting.

**`alternation_rate`** — proportion of consecutive ACTUAL-tap pairs where `TappedButtonId` switches (Left→Right or Right→Left) versus repeats (Left→Left or Right→Right). This is clinically important because the test is specifically an ALTERNATING tapping test — a patient who taps the same button repeatedly instead of alternating is showing a distinct symptom pattern from one who alternates correctly but slowly. Verify the comparison is being done on consecutive ACTUAL taps (skipping over None events in between, or treating a None as breaking the sequence — decide and confirm which makes more clinical sense, and check what the existing code actually does versus what it should do).

**`sequence_effect_slope`** — linear regression slope of tap interval over tap index within a session, meant to capture "sequence effect" (a real PD phenomenon where movements progressively slow down or shrink over a repeated sequence). Using `np.polyfit` over the raw interval array. Verify: is 20 seconds of data even long enough to reliably detect a sequence effect slope, or is this feature likely to be mostly noise at this test duration? Tell me your honest assessment rather than assuming the feature is meaningful just because it's calculable.

**`test_duration`** — last timestamp minus first timestamp for actual taps. Should roughly match ~20s per the test design; large deviations are a verification flag per the section above, not just a feature value to pass through unquestioned.

### Tremor features — what each one means and where the risk of error is highest

**`tremor_power`** and **`tremor_power_ratio`** — derived from a frequency-domain transform (FFT) of the accelerometer signal, isolating power in the ~4–6Hz band, which is the classic resting-tremor frequency range in Parkinson's. The two biggest ways this goes wrong: (1) assuming a sampling rate without verifying it from the actual timestamp deltas in the real files — if the assumed rate is wrong, the frequency bins are wrong, and the 4-6Hz band you're summing is not actually 4-6Hz; (2) not removing the gravity/DC offset (mean) from the signal before transforming — a constant offset shows up as energy at 0Hz and can distort relative power calculations if not handled. Confirm both of these are correctly handled, show me the actual computed sampling rate from real file timestamps, and show your FFT band-selection logic explicitly rather than just reporting a final number.

**`tremor_rms`** — root mean square of the signal magnitude (likely sqrt(x²+y²+z²) per sample, then RMS across the test duration, but confirm whether gravity should be subtracted first or not — RMS of raw accelerometer including gravity vs RMS of motion-only with gravity removed are different things and the difference matters for what this number actually represents).

**`dominant_freq`** — the frequency with peak power in the spectrum. Same sampling-rate-verification requirement as above applies here. Also worth checking: a single dominant frequency for a healthy "hold still" recording might genuinely be near 0 (no real periodic motion), so verify the code handles a near-zero/no-clear-peak case gracefully rather than returning a misleadingly specific number from numerical noise.

For both tapping and tremor: walk me through the actual math step by step for at least one real file each (show intermediate values, not just final feature numbers), so I can sanity check the logic myself before we trust it across all 20 files and before any of it feeds CTGAN.

---

Goal: ~1000 synthetic samples to supplement our ~20 real patients.

**Augment the extracted FEATURE columns only** (e.g. `mean_tap_interval`, `tremor_power`, `total_taps`, etc.) — do NOT attempt to synthesize raw accelerometer time-series or raw tap-event sequences. CTGAN works on tabular feature rows; trying to fabricate realistic raw sensor waveforms is a different and much harder problem we are not taking on right now.

Train CTGAN per test type (tapping features, tremor features) AFTER the label mapping question above is resolved and the real feature extraction is validated — augmenting on top of mislabeled or buggy features just produces 1000x more of the same bug, so do not skip straight to this step.

After generating synthetic samples, sanity-check them before using them for anything: do the synthetic healthy-class rows actually look like real healthy rows (similar ranges, similar correlations between features), and likewise for the symptomatic class? Show me a comparison (e.g. summary stats or a simple plot) rather than just declaring it done.

---

## Model architecture — two separate models

Build/maintain **two separate binary classifiers**: one for tapping features, one for tremor features. Do not combine them into a single unified model. They get combined later at the application layer (the combined per-session score described in "Final score" below averages both test results for a patient), but the models themselves stay independent — this mirrors the existing `binary_predict(test_input, test_type)` function structure, which takes a `test_type` argument and should continue to.

If you think a unified model would genuinely be better, tell me your reasoning, but the current plan is two separate models.

---

## Final score — combined confidence, NOT a rule-based severity formula

We are dropping the rule-based severity score and off-period detection entirely. Reasoning: the medTimepoint-based offset approach depends on having enough labeled before/after medication pairs to justify the offsets, which we don't have, and it's a clinically shaky assumption to bake in as a hardcoded correction. Off-period detection is dropped for the same reason — we don't have proper clinical ground truth to validate it against, and it's not worth the complexity right now.

**What replaces it:** when a patient takes BOTH tests in one session (tapping + tremor), take the model's confidence output from each and combine them into a single score for that session — e.g. a simple average of the two confidence scores. This becomes the one number the app graphs over time and the one number a doctor sees per session. Decide with me whether to combine the binary labels, the continuous confidence scores, or report both separately — propose whichever you think is cleanest and most useful for a doctor to read at a glance, and show me an example with real numbers before locking it in.

**If a patient only takes ONE of the two tests in a session** (tapping only, or tremor only), that session's score is just that one test's output — don't force an average when there's nothing to average with, and don't block the patient from taking just one test.

**No rolling history math, no time-window averaging, no comparing "before" vs "after" sessions.** Each test session produces one combined score independently. Trend-over-time is handled purely by the app plotting these per-session scores on a graph across dates — the trend is visual, not computed by a formula. This also means: drop the "Off-period detection" function/endpoint concept entirely, drop `severity.service.ts`-style offset logic entirely. Simpler pipeline, fewer places for a hidden assumption to hide.

### What happens to medTimepoint

medTimepoint is used ONLY during training, to help decide the binary label (healthy=0 / unhealthy=1) for each historical row, per the label-mapping discussion above. It is NOT used anywhere in the live prediction/scoring pipeline — a new test taken by a patient does not need a medTimepoint value to be scored.

There's a genuine design question still open here, and I want your read on it after you've looked at the real category counts: testing roughly twice a day (e.g. once around noon, once in the evening/night, assuming once-daily medication) may be enough to track symptom trends without needing the patient to specify WHEN relative to their medication they're testing at all. The category "Just after Parkinson medication (at your best)" was the most confusing/error-prone label last time (see "Known prior bug" above), so for any FUTURE data collection going forward, we have two options to choose between:
  1. Drop the medTimepoint question from the test-taking flow entirely — just timestamp each test and let the time-of-day plus trend over multiple tests be the signal, OR
  2. Keep asking the patient, but let them freely describe their own timing in their own words/judgment rather than picking from our 4 predefined categories, since the categories themselves are part of what caused the original confusion

Tell me which you'd recommend once you've seen how much the historical medTimepoint data actually helped distinguish your two classes during label-mapping analysis — if it turns out to be a weak signal even for training, that's a strong argument for option 1. If it's a strong signal for training, that doesn't necessarily mean we should keep collecting it the same confusing way for new data — option 2 might still be better. This is a question I want your recommendation on, not something to just implement either way.

---

## End goal — what this feeds into

The eventual output of this model needs to support a mobile app where a patient takes tapping and/or tremor tests, gets a combined per-session score (per the "Final score" section above), and a doctor can view that score plotted across sessions over time to judge whether symptoms look stable or are trending worse. There's no rule-based formula trying to interpret medication timing or detect "off periods" — the model's own confidence output, combined across whichever test(s) were taken in a session, IS the signal. The trend-reading is visual (a graph over time), done by the doctor looking at the pattern, not computed by additional logic in the pipeline. Keep this simpler shape in mind: raw data → features → model confidence → combined session score → stored and graphed. Nothing more layered on top unless we explicitly decide we need it.

---

## What I need from you right now, in order

1. Inspect the real CSV files and real JSON sample files I add to the project directory. Report back: actual column names, actual medTimepoint category counts per dataset (tapping vs tremor), actual file-reference patterns, and confirm or correct my description of the dataset architecture above.
2. Ask me anything that's unclear after that inspection — do not proceed past this step on assumptions.
3. Propose the medTimepoint → label mapping (with reasoning, per category) for both tapping and tremor datasets. Wait for my confirmation.
4. Run the per-file verification pass on all 20 real tapping files and all 20 real tremor files (per the "Verify the 20 real samples" section above). Give me the pass/fail/suspicious table before extracting or trusting any features.
5. Validate the existing tapping feature extraction code against the real JSON structure, re-deriving 2-3 files' features independently to cross-check; build/validate tremor feature extraction the same way. Walk through the math explicitly per the "Feature extraction explained" section above — don't just produce numbers.
6. Only after 1–5 are confirmed: run CTGAN augmentation to ~1000 samples per test type, and show a sanity-check comparison between real and synthetic distributions before we use them.
7. Retrain both models (tapping, tremor) on the corrected, validated, augmented data, and rerun the same kind of confidence-check tests I used before (clear healthy input → confidently low score, clear symptomatic input → confidently high score) so we can verify the original bug is actually fixed and not just relabeled differently.
8. **Before packaging anything as a pkl:** run the trained classifier(s) against the original 20 REAL patient feature rows (not synthetic ones) and show me the actual prediction for each real patient next to their actual medTimepoint-derived label, so I can eyeball whether the model's predictions make clinical sense on real people, not just on CTGAN-generated rows it may have learned to fit too easily. If any real patient's prediction looks clearly wrong, investigate why before moving on — don't average it away into an overall accuracy number and call it done.
9. Package the final feature extractors and model(s) as the `.pkl` files described in "Final deliverable" above, and explicitly test each pkl by calling it on a single new raw test input (not training-batch data) to confirm it works the way FastAPI will actually call it in production. Use this same single-input test to also verify the train/serve consistency concern raised above.

Ask me questions at every step where you're not sure. I'd rather answer ten questions now than retrain a model on a wrong assumption again.
