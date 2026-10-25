"""Ridge (linear) and gradient boosting models for SBP and DBP.

One model per target per model type — four models total:
    ridge(sbp), ridge(dbp), gbm(sbp), gbm(dbp)

Never a single shared multi-output model: HistGradientBoostingRegressor
doesn't support multi-output, so training SBP/DBP separately keeps ridge
and gradient boosting directly comparable on equal footing.

Ridge gets its features standardized first (it needs that; several of the
14 PPG features are on very different scales and some are near-collinear,
e.g. rise_fall_ratio = rise_time_s / fall_time_s). Gradient boosting uses
the raw features — tree-based models don't need scaling.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

try:
    from .baseline import compute_naive_baseline, evaluate_predictions
except ImportError:  # running as a plain script from within src/
    from baseline import compute_naive_baseline, evaluate_predictions

# The 14 features written by ppg_feature_extraction.ipynb into ppg_features.csv.
FEATURE_COLUMNS = (
    "heart_rate_bpm", "beat_interval_std_ms", "pulse_height", "rise_time_s",
    "fall_time_s", "rise_fall_ratio", "pulse_width_s", "max_upslope",
    "ppg_std", "ppg_min", "ppg_max", "ppg_range", "ppg_skewness", "ppg_kurtosis",
)
DEFAULT_TARGET_COLS = ("sbp", "dbp")


def fit_ridge(
    train_df: pd.DataFrame,
    target_col: str,
    feature_cols: tuple[str, ...] = FEATURE_COLUMNS,
    alpha: float = 1.0,
):
    """Fit a StandardScaler + Ridge pipeline for one target."""
    pipeline = make_pipeline(StandardScaler(), Ridge(alpha=alpha))
    pipeline.fit(train_df[list(feature_cols)], train_df[target_col])
    return pipeline


def fit_gbm(
    train_df: pd.DataFrame,
    target_col: str,
    feature_cols: tuple[str, ...] = FEATURE_COLUMNS,
    random_state: int = 42,
    **hgb_kwargs,
):
    """Fit a HistGradientBoostingRegressor for one target.

    Defaults use early stopping on an internal validation slice so you
    don't need to hand-tune n_estimators; override via hgb_kwargs if needed.
    """
    params = dict(max_iter=300, learning_rate=0.1, early_stopping=True, random_state=random_state)
    params.update(hgb_kwargs)
    model = HistGradientBoostingRegressor(**params)
    model.fit(train_df[list(feature_cols)], train_df[target_col])
    return model


def evaluate_model(
    model,
    df: pd.DataFrame,
    target_col: str,
    feature_cols: tuple[str, ...] = FEATURE_COLUMNS,
) -> dict[str, float]:
    """MAE/RMSE for a fitted model on any split (same metric fn as baseline.py)."""
    y_pred = model.predict(df[list(feature_cols)])
    return evaluate_predictions(df[target_col], y_pred)


def train_and_compare(
    train_df: pd.DataFrame,
    test_df: pd.DataFrame,
    target_cols: tuple[str, ...] = DEFAULT_TARGET_COLS,
    feature_cols: tuple[str, ...] = FEATURE_COLUMNS,
    ridge_alpha: float = 1.0,
    random_state: int = 42,
) -> tuple[pd.DataFrame, dict]:
    """Train naive baseline + ridge + gbm for each target and score all three.

    Returns:
        results: tidy comparison table (target x model -> mae, rmse)
        fitted: {(target, "ridge"): pipeline, (target, "gbm"): model}
    """
    baseline_values = compute_naive_baseline(train_df, target_cols)
    rows = []
    fitted = {}

    for target in target_cols:
        # Naive baseline: constant from compute_naive_baseline, scored on test.
        constant_pred = np.full(len(test_df), baseline_values[target])
        rows.append({"target": target, "model": "naive_baseline",
                     **evaluate_predictions(test_df[target], constant_pred)})

        ridge_model = fit_ridge(train_df, target, feature_cols, alpha=ridge_alpha)
        fitted[(target, "ridge")] = ridge_model
        rows.append({"target": target, "model": "ridge",
                     **evaluate_model(ridge_model, test_df, target, feature_cols)})

        gbm_model = fit_gbm(train_df, target, feature_cols, random_state=random_state)
        fitted[(target, "gbm")] = gbm_model
        rows.append({"target": target, "model": "gbm",
                     **evaluate_model(gbm_model, test_df, target, feature_cols)})

    results = pd.DataFrame(rows)[["target", "model", "mae", "rmse"]]
    return results, fitted


if __name__ == "__main__":
    # Self-test: synthetic data with a real (if noisy) feature->target
    # relationship, so we can confirm ridge/gbm actually beat the naive
    # baseline before trying this on the real 527k-row dataset.
    # Run with: python src/models.py
    from data_split import grouped_train_test_split

    rng = np.random.default_rng(0)
    files = ["Part_1.mat", "Part_2.mat", "Part_3.mat", "Part_4.mat"]
    rows = []
    for file_name in files:
        for record_index in range(400):
            n_windows = rng.integers(1, 20)
            for _ in range(n_windows):
                features = {col: rng.normal(0, 1) for col in FEATURE_COLUMNS}
                sbp = 120 + 8 * features["heart_rate_bpm"] - 5 * features["rise_fall_ratio"] + rng.normal(0, 10)
                dbp = 80 + 4 * features["pulse_height"] - 3 * features["rise_time_s"] + rng.normal(0, 7)
                rows.append({"file": file_name, "record_index": record_index,
                             "start_sample": 0, "sbp": sbp, "dbp": dbp, **features})
    fake_df = pd.DataFrame(rows)

    train_df, test_df = grouped_train_test_split(fake_df, test_size=0.2, random_state=42)
    results, fitted_models = train_and_compare(train_df, test_df)
    print(results.round(3).to_string(index=False))
