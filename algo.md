# Reel Virality Predictor — Algorithm Spec

A scrape-only, two-mode system that predicts the virality of an Instagram Reel
from its script (Mode A) or from its script + final video (Mode B). The
predictor never depends on creator-only analytics (AWT, retention curve,
skip rate, reach). It only uses signals available from public sources or
extractable from the content itself.

---

## 1. Goals

1. Predict before publishing whether a Reel will be `small`, `mid`, `hit`, or
   `mega`.
2. Run in two modes:
   - **Mode A — Script only**: usable in the writing room before shooting.
   - **Mode B — Script + Video**: usable after edit, before publish.
3. Be calibrated against *public* engagement metrics, never private analytics.
4. Expose *why* a video is predicted to under- or over-perform (top drivers
   and weak spots), not just a single score.

---

## 2. What we use vs. what we drop

### Allowed inputs
- Script / treatment text
- Final rendered video file (MP4)
- Caption + hashtags
- Audio name and Instagram audio ID
- Posting time
- Public engagement on past reels: `views`, `likes`, `comments`,
  `shares`, `reposts`, `saves`, `comment_text[]`

### Explicitly excluded
- Average Watch Time
- Skip rate / retention curve
- Reach / Impressions
- Demographic splits
- Profile visits / follows from reel
- Anything behind Meta Business Suite auth

---

## 3. Virality engines (taxonomy)

Every reel must be tagged with exactly one **primary engine**. Different
engines have different scoring weights downstream.

| Engine | Definition | Examples |
|---|---|---|
| `relevance` | Solves a problem the viewer recognizes | Carry Seat, Milk Packet |
| `spectacle` | Pure visual / conceptual novelty, no problem solved | Banana Sword, Coffee Funnel |
| `tribe` | In-group humor / identity (gender, city, fandom) | Pee-FA Cup, Sanju tribute |
| `topical` | Riding a current cultural moment / news cycle | Karan Aujla cap, Sanju tribute |
| `cringe-rage` | Debate fuel, mild outrage, "this should not exist" | Toilet Lifter, Shrek dispenser |

A reel may hit multiple engines but the predictor uses the strongest one.

---

## 4. Feature set

### 4.1 Mode A — Script only (12 features)

All extractable by an LLM reading the script with a strict JSON schema.

| # | Feature | Definition | Range |
|---|---|---|---|
| 1 | `hook_strength` | First 3s line creates curiosity gap, contrarian claim, or visual promise | 1–5 |
| 2 | `hook_variants` | Number of distinct opening lines drafted | int |
| 3 | `narrative_beats` | Distinct story turns (problem → fail → retry → reveal …) | int |
| 4 | `beats_per_10s` | `narrative_beats / (duration_s / 10)` | float |
| 5 | `tam_breadth` | 1 = niche, 5 = universal | 1–5 |
| 6 | `kcta_weighted` | K(0–2) + C(0–2) + T(0–2) + A(0–1), graded not binary | 0–7 |
| 7 | `engine` | one of `relevance / spectacle / tribe / topical / cringe-rage` | enum |
| 8 | `emotional_trigger` | Strength of the dominant emotion (laugh, wow, pride, disgust, nostalgia) | 1–5 |
| 9 | `tag_a_friend` | Can a reader name a specific person who needs to see this? | 1–5 |
| 10 | `novelty` | Concept never-seen-before quotient | 1–5 |
| 11 | `trend_alignment` | Topic is riding a current cultural moment | 0–5 |
| 12 | `stakes_conflict` | Clear "will it work?" arc present | 0–3 |

### 4.2 Mode B — Script + Video (8 additional features)

Computed locally — no scraping needed for the predictor itself.

| # | Feature | Extraction | Range |
|---|---|---|---|
| 13 | `visual_hook` | Vision-LLM scores the first 30 frames as a grid for stop-scroll power | 1–5 |
| 14 | `cuts_per_second` | Scene-change count via PySceneDetect / `ffmpeg` | float |
| 15 | `text_density` | OCR coverage % averaged over sampled frames | 0–1 |
| 16 | `face_time_ratio` | Frames containing ≥1 face / total sampled frames | 0–1 |
| 17 | `color_saturation_index` | Mean HSV saturation of sampled frames | 0–1 |
| 18 | `audio_trend_match` | Audio ID present in trending-audio snapshot of the last 7 days | 0/1 |
| 19 | `loopability` | Last second visually/audibly bridges to first second | 0–3 |
| 20 | `caption_echo` | Caption restates hook (1) or adds a second hook (2) | 0–2 |

---

## 5. Calibration target (built from public stats only)

For every reel in the calibration set, compute:

```
share_rate   = shares   / max(views, 1)
save_rate    = saves    / max(views, 1)
comment_rate = comments / max(views, 1)
like_rate    = likes    / max(views, 1)

virality_target =
      0.40 * log10(views + 1)
    + 0.25 * z(share_rate)
    + 0.15 * z(save_rate)
    + 0.10 * z(comment_rate)
    + 0.10 * z(like_rate)
```

Where `z(x)` is z-score over the calibration corpus. This separates *quality*
(humans actively pushed it) from *reach* (the algorithm distributed it).

---

## 6. Scoring model

### 6.1 Until you have ≥150 labeled reels: rubric-based

Use the following hand-set weights. Each sub-score is normalized to 0–1 then
weighted.

```
score =
    0.20 * tam_breadth_norm
  + 0.20 * kcta_weighted_norm
  + 0.15 * novelty_norm
  + 0.15 * visual_hook_norm           # Mode B only; Mode A: substitute hook_strength_norm
  + 0.10 * tag_a_friend_norm
  + 0.10 * emotional_trigger_norm
  + 0.05 * trend_alignment_norm
  + 0.05 * stakes_conflict_norm
```

Mode A reweights the missing `visual_hook` slot onto `hook_strength` and
`novelty`:

```
score_modeA =
    0.20 * tam_breadth_norm
  + 0.20 * kcta_weighted_norm
  + 0.20 * novelty_norm
  + 0.20 * hook_strength_norm
  + 0.10 * tag_a_friend_norm
  + 0.05 * emotional_trigger_norm
  + 0.03 * trend_alignment_norm
  + 0.02 * stakes_conflict_norm
```

### 6.2 Once ≥150 labeled reels exist: fitted Ridge regression

Fit a Ridge regression (`sklearn.linear_model.Ridge`, alpha tuned via
5-fold CV) of feature vector → `virality_target`. Persist coefficients to
`weights.json` and reload at predict time.

Refit weekly via cron.

### 6.3 Engine-specific bias correction

For each engine, compute the residual bias on the calibration set and add it
back at predict time. This corrects systematic under-prediction of the
`spectacle` engine in Mode A.

```
final_score = raw_score + engine_bias[engine]
```

---

## 7. Output buckets

Bucket boundaries are quartiles of the calibration set's `virality_target`:

| Bucket | Definition |
|---|---|
| `small` | below P25 |
| `mid`   | P25 – P50 |
| `hit`   | P50 – P85 |
| `mega`  | above P85 |

---

## 8. Output schema

```json
{
  "mode": "script_only" | "script_plus_video",
  "score": 3.82,
  "bucket": "hit",
  "engine": "spectacle",
  "confidence": 0.62,
  "top_drivers": [
    { "feature": "novelty", "contribution": 0.78 },
    { "feature": "tag_a_friend", "contribution": 0.40 },
    { "feature": "kcta_weighted", "contribution": 0.35 }
  ],
  "weak_spots": [
    { "feature": "hook_strength", "contribution": 0.05, "suggestion": "Rewrite first line — current opener doesn't promise a visual payoff." },
    { "feature": "trend_alignment", "contribution": 0.00, "suggestion": "Tie to a current trend or audio." }
  ],
  "warnings": [
    "spectacle engine — script alone underestimates visual payoff; run Mode B before publishing"
  ]
}
```

`confidence` is `1 - feature_uncertainty`, where uncertainty is higher when
the engine is `spectacle` and Mode A is used, or when fewer than 150
calibration samples exist.

---

## 9. Mode A pipeline

```
script.txt + duration_s
        │
        ▼
  LLM(structured JSON, schema = features 1–12)
        │
        ▼
  normalize features → feature_vector_12
        │
        ▼
  scoring_engine.predict(feature_vector_12, mode="A")
        │
        ▼
  attach engine warnings → output
```

LLM extraction MUST use a strict JSON schema and a temperature ≤ 0.2. Reject
and retry once if output fails schema validation.

---

## 10. Mode B pipeline

```
script.txt + duration_s + video.mp4
        │
        ├──▶ LLM features 1–12              (same as Mode A)
        │
        ├──▶ ffprobe → duration, fps, resolution
        │
        ├──▶ PySceneDetect → cuts_per_second
        │
        ├──▶ sample N=30 frames evenly:
        │       ├─ EasyOCR → text_density
        │       ├─ face_recognition → face_time_ratio
        │       └─ HSV mean → color_saturation_index
        │
        ├──▶ first 30 frames as 5x6 grid → vision-LLM → visual_hook
        │
        ├──▶ extract audio_id from caption metadata or audio fingerprint
        │       → lookup against trending_audio.json (last 7 days)
        │       → audio_trend_match
        │
        ├──▶ compare last 1s frame vs first 1s frame (perceptual hash) +
        │     audio cross-correlation → loopability
        │
        └──▶ caption analysis vs hook line → caption_echo
        │
        ▼
  feature_vector_20
        │
        ▼
  scoring_engine.predict(feature_vector_20, mode="B")
```

---

## 11. Calibration / training pipeline

```
public_scraper(handles[]) ─▶ raw_reels.csv
                                │
                                ▼
        compute virality_target  (§5)
                                │
                                ▼
   feature_extractor (Mode B for all, since video is downloadable)
                                │
                                ▼
        labeled_dataset.csv  (features + target)
                                │
                                ▼
   Ridge.fit  →  weights.json
                                │
                                ▼
   bucket_boundaries.json   (quartiles of target)
                                │
                                ▼
   engine_bias.json         (mean residual per engine)
```

Scraping is **public-only** (no auth, no private endpoints). Use
`instaloader` or equivalent. Respect rate limits. Cache aggressively.

---

## 12. LLM extraction prompt (Mode A — verbatim)

```
You are a feature extractor for a virality prediction model. Read the
reel script below and return ONLY a JSON object that conforms to the
schema. Be honest — under-rate when in doubt. Never inflate.

Schema:
{
  "hook_strength":     integer 1..5,
  "hook_variants":     integer >=1,
  "narrative_beats":   integer >=1,
  "tam_breadth":       integer 1..5,
  "kcta": {
    "know":  integer 0..2,
    "care":  integer 0..2,
    "think": integer 0..2,
    "aware": integer 0..1
  },
  "engine":            "relevance"|"spectacle"|"tribe"|"topical"|"cringe-rage",
  "emotional_trigger": { "kind": string, "intensity": integer 1..5 },
  "tag_a_friend":      integer 1..5,
  "novelty":           integer 1..5,
  "trend_alignment":   integer 0..5,
  "stakes_conflict":   integer 0..3,
  "rationale":         string  // <=120 chars, why these scores
}

Script:
"""<<<SCRIPT>>>"""

Duration (seconds): <<<DURATION>>>
```

The host code computes `kcta_weighted = 2*know + 2*care + 2*think + aware` and
`beats_per_10s = narrative_beats / (duration / 10)`.

---

## 13. API surface

```
POST /predict
Content-Type: multipart/form-data

fields:
  mode      = "script_only" | "script_plus_video"
  script    = string                        (required)
  duration  = number, seconds               (required)
  video     = file, mp4                     (required if mode = script_plus_video)
  caption   = string                        (optional)
  audio_id  = string                        (optional, used if mode = script_plus_video)

response: see §8
```

Auxiliary endpoints:

```
POST /calibrate            # triggers a refit; admin-only
GET  /weights              # returns current weights.json
GET  /health               # returns model_version, n_calibration_samples
```

---

## 14. Repo layout

```
predictor/
├── ingestors/
│   ├── script_parser.py        # LLM extracts features 1–12
│   └── video_features.py       # ffmpeg + PySceneDetect + face_recognition + OCR
├── vision/
│   └── hook_scorer.py          # vision-LLM call on first-30-frames grid
├── scraper/
│   ├── ig_public.py            # public Reels metadata
│   └── trend_audio.py          # daily snapshot of trending audio IDs
├── model/
│   ├── target.py               # builds virality_target from public stats
│   ├── train.py                # Ridge regression
│   ├── predict.py              # Mode A / B entrypoints
│   └── buckets.py              # quartile boundaries + engine bias
├── data/
│   ├── calibration.csv         # seed: your 25 + scraped competitors
│   ├── weights.json
│   ├── bucket_boundaries.json
│   ├── engine_bias.json
│   └── trending_audio.json     # refreshed daily
├── api.py                      # FastAPI
├── tests/
│   ├── test_features.py
│   ├── test_predict.py
│   └── fixtures/
└── README.md
```

Recommended deps: `fastapi`, `pydantic`, `scikit-learn`, `numpy`, `pandas`,
`scenedetect`, `easyocr`, `face_recognition`, `librosa`, `imagehash`,
`instaloader`, `httpx`, `openai` or `anthropic` SDK, `python-dotenv`.

---

## 15. Test plan

### 15.1 Unit tests
- Feature extractors return values within declared ranges.
- LLM extractor: feeding 5 known scripts produces stable scores within ±1
  across 3 runs (temperature ≤ 0.2).
- Video extractors: deterministic on a fixed sample MP4.

### 15.2 Backtest
- Hold out 5 of your 25 labeled reels.
- Train on 20, predict on 5.
- Report bucket accuracy (top-1, top-2 adjacent), Spearman rank correlation
  with `virality_target`.
- Acceptance: top-2 adjacent bucket accuracy ≥ 70%.

### 15.3 Outlier diagnostics
The five known outliers from the seed dataset (Banana Sword, Coffee Funnel,
Carry Seat, Karan Aujla, Bum Buddy) must each be correctly classified within
±1 bucket after Mode B + engine-bias correction.

### 15.4 Confidence calibration
Predicted `confidence` should correlate with actual error: bin predictions
into low/mid/high confidence and check that the high-confidence bin has the
lowest mean absolute error.

---

## 16. Known limitations

1. **Small N**: with only 25 labeled reels, Mode B has 20 features → fit will
   overfit. Stay on rubric weights until calibration set ≥ 150.
2. **Spectacle blind spot in Mode A**: scripts under-describe visual payoff.
   Always emit a `confidence_low` warning when `engine = spectacle` and mode
   is `script_only`.
3. **Trend audio decay**: `trending_audio.json` must be refreshed at least
   daily, ideally every 6 hours.
4. **Distribution luck**: even a perfect intrinsic score cannot predict cold
   starts when the IG algorithm under-distributes. Treat the score as a
   ceiling, not a floor.

---

## 17. Versioning

```
model_version  = "<semver>"
schema_version = "<semver>"
```

Every prediction response embeds both. Bump `schema_version` only on
breaking changes to the feature set; bump `model_version` on every refit.

---

## 18. Roadmap

- v0.1: Mode A only, rubric weights, single-script CLI.
- v0.2: Mode B, video features, FastAPI.
- v0.3: Public scraper + calibration loop, fitted weights.
- v0.4: Engine-specific sub-models (separate Ridge per engine).
- v0.5: Comment-text sentiment / debate-detection feature for post-publish
  re-prediction (drives second-wave promotion decisions).
