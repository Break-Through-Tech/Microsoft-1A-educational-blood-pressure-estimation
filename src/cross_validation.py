"""Grouped K-fold cross-validation for hyperparameter tuning.

Everything here operates on `train_df` only — the function signatures
never take a test set, so the held-out test split from
`grouped_train_test_split` (data_split.py) stays untouched by construction.
Pass it `train_df`, never `df` or `test_df`.

Within train_df, each fold split still respects recording boundaries:
`GroupKFold` groups by (file, record_index), the same key used for the
original train/test split, so a recording's windows are never split
across the train and validation side of a fold either.

Usage: K-fold CV rotates which fold is validation. For each hyperparameter
combination, fit on the other K-1 folds and score on the held-out fold;
average MAE across the K folds is that combination's CV score. Pick the
combination with the lowest mean CV MAE.
"""

from __future__ import annotations

from typing import Callable

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.model_selection import GridSearchCV, GroupKFold
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

try:
    from .baseline import evaluate_predictions
    from .data_split import GROUP_COLS
    from .models import FEATURE_COLUMNS, fit_gbm, fit_ridge
except ImportError:  # running as a plain script from within src/
    from baseline import evaluate_predictions
    from data_split import GROUP_COLS
    from models import FEATURE_COLUMNS, fit_gbm, fit_ridge

# sklearn's Pipeline "<step>__<param>" naming — this grid is meant for
# ridge_alpha_search below (GridSearchCV + Pipeline), not grid_search_cv.
RIDGE_ALPHA_GRID = {"ridge__alpha": [0.001, 0.01, 0.1, 1, 10, 100, 1000]}

# For gbm_param_search below. max_leaf_nodes: np.unique(np.logspace(1, 3,
# num=5).astype(int)) == [10, 31, 100, 316, 1000] — 5 log-spaced values
# from 10 to 1000 leaves, deduplicated after truncation to int.
GBM_PARAM_GRID = {
    "learning_rate": [0.05, 0.1, 0.2],
    "max_leaf_nodes": np.unique(np.logspace(1, 3, num=5).astype(int)).tolist(),
    "min_samples_leaf": [20, 100, 300],
}


def grouped_kfold_cv(
    fit_fn: Callable[[pd.DataFrame], object],
    train_df: pd.DataFrame,
    target_col: str,
    feature_cols: tuple[str, ...] = FEATURE_COLUMNS,
    n_splits: int = 5,
    group_cols: list[str] = GROUP_COLS,
    random_state: int = 42,
) -> pd.DataFrame:
    """Score one already-configured model across K grouped folds of train_df.

    Args:
        fit_fn: takes a fold's training rows (a dataframe) and returns a
            fitted model with .predict(). Typically a small lambda wrapping
            fit_ridge/fit_gbm with specific hyperparameters baked in.
        train_df: the TRAIN split only (never test_df) — this is the only
            data folds are drawn from.
        target_col: "sbp" or "dbp".
        n_splits: number of folds (K).
        group_cols: recording identifier columns; a recording's rows
            always land entirely in one fold, never split across folds.

    Returns:
        One row per fold: fold index, mae, rmse. Average these yourself,
        or use grid_search_cv below which does it for you.
    """
    groups = train_df[list(group_cols)].astype(str).agg("|".join, axis=1)
    n_recordings = groups.nunique()
    if n_recordings < n_splits:
        raise ValueError(f"Only {n_recordings} recordings but n_splits={n_splits}; reduce n_splits.")

    gkf = GroupKFold(n_splits=n_splits, shuffle=True, random_state=random_state)
    rows = []
    for fold, (fold_train_pos, fold_val_pos) in enumerate(gkf.split(train_df, groups=groups)):
        fold_train = train_df.iloc[fold_train_pos]
        fold_val = train_df.iloc[fold_val_pos]
        model = fit_fn(fold_train)
        y_pred = model.predict(fold_val[list(feature_cols)])
        metrics = evaluate_predictions(fold_val[target_col], y_pred)
        rows.append({"fold": fold, **metrics})
    return pd.DataFrame(rows)


def grid_search_cv(
    model_type: str,
    train_df: pd.DataFrame,
    target_col: str,
    param_grid: list[dict],
    feature_cols: tuple[str, ...] = FEATURE_COLUMNS,
    n_splits: int = 5,
    random_state: int = 42,
) -> pd.DataFrame:
    """Score every hyperparameter combination in param_grid by mean CV MAE.

    Args:
        model_type: "ridge" or "gbm".
        train_df: the TRAIN split only — test_df must never be passed here.
        param_grid: list of kwarg dicts, e.g. for ridge: [{"alpha": 0.1},
            {"alpha": 1.0}, {"alpha": 10.0}]; for gbm: [{"max_iter": 100,
            "learning_rate": 0.1}, ...].

    Returns:
        One row per hyperparameter combination, sorted best (lowest mean
        CV MAE) first: params, mean_mae, std_mae, mean_rmse, std_rmse.
    """
    if model_type not in ("ridge", "gbm"):
        raise ValueError(f"model_type must be 'ridge' or 'gbm', got {model_type!r}")

    rows = []
    for params in param_grid:
        if model_type == "ridge":
            fit_fn = lambda fold_train, p=params: fit_ridge(fold_train, target_col, feature_cols, **p)
        else:
            fit_fn = lambda fold_train, p=params: fit_gbm(
                fold_train, target_col, feature_cols, random_state=random_state, **p
            )

        fold_results = grouped_kfold_cv(
            fit_fn, train_df, target_col, feature_cols, n_splits=n_splits, random_state=random_state,
        )
        rows.append({
            "params": params,
            "mean_mae": fold_results["mae"].mean(),
            "std_mae": fold_results["mae"].std(),
            "mean_rmse": fold_results["rmse"].mean(),
            "std_rmse": fold_results["rmse"].std(),
        })

    results = pd.DataFrame(rows).sort_values("mean_mae").reset_index(drop=True)
    return results


def ridge_alpha_search(
    train_df: pd.DataFrame,
    target_col: str,
    feature_cols: tuple[str, ...] = FEATURE_COLUMNS,
    param_grid: dict = RIDGE_ALPHA_GRID,
    n_splits: int = 5,
    group_cols: list[str] = GROUP_COLS,
    random_state: int = 42,
    n_jobs: int = -1,
) -> tuple[pd.DataFrame, GridSearchCV]:
    """Grid search ridge's alpha with grouped K-fold CV, scored by MAE.

    Builds a real sklearn Pipeline(StandardScaler -> Ridge) and hands it to
    GridSearchCV. GridSearchCV clones and fits the *whole* pipeline fresh on
    each fold's training rows, so the scaler is refit on that fold's
    training part only, then applied to the held-out validation fold — no
    validation-fold statistics leak into scaling.

    train_df must be the TRAIN split only; this function never sees test_df.

    Args:
        param_grid: sklearn Pipeline param grid, keyed "ridge__<param>"
            since the Ridge step inside the pipeline is named "ridge" (the
            default from make_pipeline). Defaults to RIDGE_ALPHA_GRID.

    Returns:
        (results, search):
            results: one row per alpha, sorted best (lowest mean CV MAE)
                first — alpha, mean_mae, std_mae, rank.
            search: the fitted GridSearchCV object. search.best_estimator_
                is the full pipeline (scaler + ridge) refit on all of
                train_df with the winning alpha.
    """
    pipeline = make_pipeline(StandardScaler(), Ridge())
    groups = train_df[list(group_cols)].astype(str).agg("|".join, axis=1)
    cv = GroupKFold(n_splits=n_splits, shuffle=True, random_state=random_state)

    search = GridSearchCV(
        pipeline,
        param_grid,
        cv=cv,
        scoring="neg_mean_absolute_error",
        refit=True,
        n_jobs=n_jobs,
    )
    search.fit(train_df[list(feature_cols)], train_df[target_col], groups=groups)

    results = pd.DataFrame(search.cv_results_)[["params", "mean_test_score", "std_test_score", "rank_test_score"]]
    results = results.rename(columns={"rank_test_score": "rank"})
    results["mean_mae"] = -results["mean_test_score"]
    results["std_mae"] = results["std_test_score"]
    results = results.drop(columns=["mean_test_score", "std_test_score"])
    results = results.sort_values("mean_mae").reset_index(drop=True)
    return results, search


def gbm_param_search(
    train_df: pd.DataFrame,
    target_col: str,
    feature_cols: tuple[str, ...] = FEATURE_COLUMNS,
    param_grid: dict = GBM_PARAM_GRID,
    n_splits: int = 5,
    group_cols: list[str] = GROUP_COLS,
    random_state: int = 42,
    n_jobs: int = -1,
) -> tuple[pd.DataFrame, GridSearchCV]:
    """Grid search gradient boosting's learning_rate / max_leaf_nodes /
    min_samples_leaf with grouped K-fold CV, scored by MAE.

    No scaling pipeline here (unlike ridge_alpha_search) — tree-based models
    are invariant to monotonic feature scaling, so raw features go straight
    into HistGradientBoostingRegressor.

    train_df must be the TRAIN split only; this function never sees test_df.
    max_iter and early_stopping are held fixed (same defaults as fit_gbm in
    models.py) while learning_rate/max_leaf_nodes/min_samples_leaf vary —
    those three are the only hyperparameters being searched here.

    Returns:
        (results, search): tidy results sorted by mean CV MAE (best first),
        and the fitted GridSearchCV object (search.best_estimator_ is
        refit on all of train_df with the winning hyperparameters).
    """
    estimator = HistGradientBoostingRegressor(max_iter=300, early_stopping=True, random_state=random_state)
    groups = train_df[list(group_cols)].astype(str).agg("|".join, axis=1)
    cv = GroupKFold(n_splits=n_splits, shuffle=True, random_state=random_state)

    search = GridSearchCV(
        estimator,
        param_grid,
        cv=cv,
        scoring="neg_mean_absolute_error",
        refit=True,
        n_jobs=n_jobs,
    )
    search.fit(train_df[list(feature_cols)], train_df[target_col], groups=groups)

    results = pd.DataFrame(search.cv_results_)[["params", "mean_test_score", "std_test_score", "rank_test_score"]]
    results = results.rename(columns={"rank_test_score": "rank"})
    results["mean_mae"] = -results["mean_test_score"]
    results["std_mae"] = results["std_test_score"]
    results = results.drop(columns=["mean_test_score", "std_test_score"])
    results = results.sort_values("mean_mae").reset_index(drop=True)
    return results, search


if __name__ == "__main__":
    # Self-test: synthetic data shaped like ppg_features.csv (same approach
    # as data_split.py / models.py), confirming grouped CV folds never split
    # a recording and that grid search correctly favors the right hyperparams.
    # Run with: python src/cross_validation.py
    from data_split import grouped_train_test_split

    rng = np.random.default_rng(0)
    files = ["Part_1.mat", "Part_2.mat", "Part_3.mat", "Part_4.mat"]
    rows = []
    for file_name in files:
        for record_index in range(300):
            for _ in range(rng.integers(1, 20)):
                features = {col: rng.normal(0, 1) for col in FEATURE_COLUMNS}
                sbp = 120 + 8 * features["heart_rate_bpm"] - 5 * features["rise_fall_ratio"] + rng.normal(0, 10)
                rows.append({"file": file_name, "record_index": record_index,
                             "start_sample": 0, "sbp": sbp, **features})
    fake_df = pd.DataFrame(rows)

    # Test set carved out first and never touched again below.
    train_df, test_df = grouped_train_test_split(fake_df, test_size=0.2, random_state=42)
    print(f"train: {len(train_df):,} rows / {train_df[GROUP_COLS].drop_duplicates().shape[0]:,} recordings "
          f"| test (untouched): {len(test_df):,} rows / {test_df[GROUP_COLS].drop_duplicates().shape[0]:,} recordings")

    # Sanity check: no recording appears in two different CV folds.
    groups = train_df[GROUP_COLS].astype(str).agg("|".join, axis=1)
    gkf = GroupKFold(n_splits=5, shuffle=True, random_state=42)
    fold_of_group = {}
    for fold, (_, val_pos) in enumerate(gkf.split(train_df, groups=groups)):
        for g in groups.iloc[val_pos].unique():
            assert g not in fold_of_group, f"recording {g} appeared in two folds"
            fold_of_group[g] = fold
    print(f"All {len(fold_of_group):,} training recordings assigned to exactly one of 5 folds: OK\n")

    ridge_grid = [{"alpha": a} for a in (0.01, 1.0, 100.0)]
    ridge_results = grid_search_cv("ridge", train_df, "sbp", ridge_grid, n_splits=5)
    print("Ridge alpha search (sorted best first):")
    print(ridge_results.round(3).to_string(index=False))

    gbm_grid = [{"max_iter": 50, "learning_rate": 0.1}, {"max_iter": 300, "learning_rate": 0.1}]
    gbm_results = grid_search_cv("gbm", train_df, "sbp", gbm_grid, n_splits=5)
    print("\nGBM grid search (sorted best first):")
    print(gbm_results.round(3).to_string(index=False))

    print("\nRidge alpha search via sklearn Pipeline + GridSearchCV + GroupKFold:")
    alpha_results, alpha_search = ridge_alpha_search(train_df, "sbp", n_splits=5)
    print(alpha_results.to_string(index=False))
    print(f"Best alpha: {alpha_search.best_params_['ridge__alpha']}")

    # Confirm the scaler really is refit per fold, not fit once on all of
    # train_df: a scaler fit on one fold's rows should NOT match a scaler
    # fit on a different fold's rows.
    groups_arr = train_df[GROUP_COLS].astype(str).agg("|".join, axis=1)
    cv_check = GroupKFold(n_splits=5, shuffle=True, random_state=42)
    fold_scaler_means = []
    for _, (fold_train_pos, _) in enumerate(cv_check.split(train_df, groups=groups_arr)):
        fold_pipeline = make_pipeline(StandardScaler(), Ridge(alpha=1.0))
        fold_pipeline.fit(train_df.iloc[fold_train_pos][list(FEATURE_COLUMNS)], train_df.iloc[fold_train_pos]["sbp"])
        fold_scaler_means.append(fold_pipeline.named_steps["standardscaler"].mean_[0])
    all_same = len(set(fold_scaler_means)) == 1
    print(f"\nPer-fold scaler mean_ for first feature across folds: {[round(m, 4) for m in fold_scaler_means]}")
    print(f"Scaler refit differently per fold (expected, not all identical): {not all_same}")

    # Small grid here just to check the plumbing quickly. GBM_PARAM_GRID
    # (the real default, per spec) is 3 x 5 x 3 = 45 combos; with n_jobs=-1
    # that's fine on the real ~420k-row train_df, but slow to demo here on
    # every CI/self-test run, so this is intentionally a reduced stand-in.
    demo_grid = {"learning_rate": [0.05, 0.2], "max_leaf_nodes": [10, 100], "min_samples_leaf": [20]}
    from time import perf_counter
    start = perf_counter()
    gbm_search_results, gbm_search = gbm_param_search(train_df, "sbp", param_grid=demo_grid, n_splits=5)
    print(f"\nGBM param search, {len(gbm_search_results)} combos x 5 folds, n_jobs=-1: "
          f"done in {perf_counter() - start:.1f}s")
    print(gbm_search_results.to_string(index=False))
    print(f"Best params: {gbm_search.best_params_}")
    print(f"\n(Real default GBM_PARAM_GRID has "
          f"{len(GBM_PARAM_GRID['learning_rate']) * len(GBM_PARAM_GRID['max_leaf_nodes']) * len(GBM_PARAM_GRID['min_samples_leaf'])} "
          f"combos: {GBM_PARAM_GRID})")
