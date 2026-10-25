"""Naive baseline: predict a constant value, ignoring all features.

This is the floor every real model (linear regression, gradient boosting)
must beat. If a model can't do better than "just guess the average SBP/DBP
from training data," it isn't learning anything useful from the PPG
features.

Fit the baseline on train_df only, then evaluate it on test_df — same
train/test split produced by `grouped_train_test_split` in data_split.py,
so this baseline is held to the same no-leakage standard as the real
models.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

DEFAULT_TARGET_COLS = ("sbp", "dbp")


def compute_naive_baseline(
    train_df: pd.DataFrame,
    target_cols: tuple[str, ...] = DEFAULT_TARGET_COLS,
    method: str = "mean",
) -> dict[str, float]:
    """Compute one constant prediction per target from the training set.

    Args:
        train_df: training split only — never look at test_df here.
        target_cols: label columns to build a baseline for, e.g. sbp/dbp.
        method: "mean" (minimizes squared error, the usual baseline) or
            "median" (minimizes absolute error, more robust to outliers).

    Returns:
        {target_col: constant_value}
    """
    if method not in ("mean", "median"):
        raise ValueError(f"method must be 'mean' or 'median', got {method!r}")

    missing = [c for c in target_cols if c not in train_df.columns]
    if missing:
        raise ValueError(f"train_df is missing target column(s): {missing}")

    agg = train_df[list(target_cols)].mean() if method == "mean" else train_df[list(target_cols)].median()
    return agg.to_dict()


def evaluate_predictions(y_true: pd.Series | np.ndarray, y_pred: pd.Series | np.ndarray) -> dict[str, float]:
    """MAE and RMSE for one target. Reusable later for the real models too."""
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    error = y_true - y_pred
    mae = np.mean(np.abs(error))
    rmse = np.sqrt(np.mean(error**2))
    return {"mae": mae, "rmse": rmse}


def evaluate_naive_baseline(
    baseline_values: dict[str, float],
    test_df: pd.DataFrame,
    target_cols: tuple[str, ...] = DEFAULT_TARGET_COLS,
) -> pd.DataFrame:
    """Score the constant baseline against the held-out test split.

    Returns a tidy table: one row per target, with the predicted constant
    and its MAE/RMSE on test_df.
    """
    rows = []
    for col in target_cols:
        constant = baseline_values[col]
        y_pred = np.full(len(test_df), constant)
        metrics = evaluate_predictions(test_df[col], y_pred)
        rows.append({"target": col, "predicted_value": constant, **metrics})
    return pd.DataFrame(rows)


if __name__ == "__main__":
    # Self-test with the same synthetic data shape used in data_split.py.
    # Run with: python src/baseline.py
    from data_split import grouped_train_test_split, split_summary

    rng = np.random.default_rng(0)
    files = ["Part_1.mat", "Part_2.mat", "Part_3.mat", "Part_4.mat"]
    rows = []
    for file_name in files:
        for record_index in range(300):
            n_windows = rng.integers(1, 20)
            for w in range(n_windows):
                rows.append(
                    {
                        "file": file_name,
                        "record_index": record_index,
                        "start_sample": w * 625,
                        "sbp": rng.normal(120, 15),
                        "dbp": rng.normal(80, 10),
                    }
                )
    fake_df = pd.DataFrame(rows)

    train_df, test_df = grouped_train_test_split(fake_df, test_size=0.2, random_state=42)
    print(split_summary(train_df, test_df).to_string(index=False))

    baseline_values = compute_naive_baseline(train_df)
    print("\nNaive baseline (train-set mean):", baseline_values)

    results = evaluate_naive_baseline(baseline_values, test_df)
    print("\nBaseline performance on held-out test recordings:")
    print(results.round(3).to_string(index=False))
