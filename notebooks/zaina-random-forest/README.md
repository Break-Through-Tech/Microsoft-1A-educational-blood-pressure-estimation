# Cuff-less Blood Pressure Estimation: Random Forest on PPG Features

Individual model for the **Break Through Tech AI Studio (Fall 2026)** CufflessAI challenge (Microsoft).

A `RandomForestRegressor` estimates **systolic (SBP)** and **diastolic (DBP)** blood pressure from hand-crafted features of **5-second PPG windows** (625 samples at 125 Hz). It is compared against a naive "predict the training mean" baseline.

> **Educational prototype only.** Not a medical device; do not use for health decisions.

## Files

| File | Purpose |
|---|---|
| `cuffless_bp_random_forest.ipynb` | The full pipeline (load, window, label, features, split, train, evaluate, plot, save) |
| `requirements.txt` | Python dependencies |
| `README.md` | This file |

Running the notebook creates an `outputs/` folder (model, metrics, predictions, figures, cached features).

## Data

Download `Part_1.mat` from the UCI [Cuff-Less Blood Pressure Estimation](https://archive.ics.uci.edu/dataset/340/cuff%2Bless%2Bblood%2Bpressure%2Bestimation) dataset. The file is large, so **do not commit it to GitHub** (add `Part_1.mat` and `outputs/` to `.gitignore`).

## How to run

### Locally
```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
jupyter notebook cuffless_bp_random_forest.ipynb
```
Set `DATA_PATH` in the **Configuration** cell to where `Part_1.mat` is, then run all cells.

### Google Colab
1. Upload the notebook to Colab (File → Upload notebook).
2. Upload `Part_1.mat` to the session (Files sidebar) or put it in Google Drive.
3. Set `DATA_PATH` (`"Part_1.mat"` or `"/content/drive/MyDrive/.../Part_1.mat"`); run the Drive-mount cell if using Drive.
4. Run all cells (the first cell installs `h5py` and friends).

## What the notebook does

1. **Inspect** the HDF5 structure so you can verify assumptions.
2. **Load** records via h5py: the top-level `Part_1` is a cell array of HDF5 object references; each is followed and reoriented to `(n_samples, 3)`. Only PPG and ABP are kept; they share the same time index, so they stay aligned.
3. **Window** into non-overlapping 625-sample windows using identical indices for PPG and ABP.
4. **Labels:** SBP = median ABP peak height, DBP = median ABP valley height per window. Windows with NaNs, too few beats, implausible values, or tiny pulse pressure are discarded.
5. **Features (30) from PPG:** mean, std, min, max, range, median, percentiles, skewness, kurtosis, RMS, mean absolute change, first-derivative statistics, beat features (count, heart rate, inter-beat interval stats, pulse amplitude, rise time), and spectral features.
6. **Split by recording** with `GroupShuffleSplit` (an assertion checks that no recording is in both train and test).
7. **Train** `RandomForestRegressor` (multi-output: SBP and DBP) and a mean baseline.
8. **Evaluate** with MAE, RMSE, R² for SBP and DBP.
9. **Plots:** actual vs. predicted, residuals, MAE vs. baseline, feature importance (impurity and permutation).
10. **Save** model, metrics, predictions, importances, and figures to `outputs/`.

## Configuration highlights

| Setting | Default | Notes |
|---|---|---|
| `DATA_PATH` | `"Part_1.mat"` | Change to your file location |
| `MAX_RECORDINGS` | `300` | Random subset; `None` = all (~3000 records) |
| `MAX_WINDOWS_PER_RECORDING` | `40` | Evenly spaced; `None` = no cap |
| `WINDOW_SECONDS` | `5` | Use 3 or 10 to compare with earlier experiments |
| `TEST_SIZE` | `0.2` | Fraction of **recordings** held out |
| `RANDOM_SEED` | `42` | Reproducibility |

## Assumptions to verify (flagged in the notebook)

- The top-level variable is named `Part_1` and is a cell array of HDF5 references (set `MAT_KEY` otherwise).
- Channel order per record is **PPG, ABP, ECG** (`CH_PPG=0, CH_ABP=1, CH_ECG=2`). The inspection cell prints value ranges; ABP should look like mmHg.
- Records may appear as `(n_samples, 3)` or `(3, n_samples)` in h5py; both are handled.
- ABP peak/valley thresholds (`prominence=10`, min spacing 0.3 s) and the plausibility ranges are reasonable defaults, not validated against this dataset.

## Limitations

- **No patient IDs in `Part_1.mat`.** A recording-level split does **not guarantee patient independence**; the same patient may appear in both train and test, so scores can be optimistic. State this when reporting results.
- Results depend on the subset size and filtering thresholds. Report your settings.
- Hand-crafted statistical features carry limited information about blood pressure; modest accuracy is expected, and this is a learning prototype rather than a clinical-grade estimator.

## Testing status

The code was only exercised against **synthetic stand-in data** (with a stub in place of `h5py`) to check that the pipeline runs end to end. It has **not** been run on the real `Part_1.mat`, and no real performance numbers exist until you run it.
