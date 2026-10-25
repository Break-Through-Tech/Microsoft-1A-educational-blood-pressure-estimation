"""Feature importance for the ridge and gradient boosting models.

Two different methods on purpose, one per model type, so each number
means what it actually claims to mean:

- Ridge: coefficients from the *scaled* features (inside the pipeline),
  so their size is directly comparable across all 14 features. Sign
  shows direction — does the feature push the prediction up or down.

- Gradient boosting: permutation importance, not the model's built-in
  `feature_importances_`. Built-in tree importances can be misleading
  when features are correlated — several of ours are, e.g. rise_time_s
  and fall_time_s both feed rise_fall_ratio. Permutation importance
  instead measures how much shuffling one feature actually hurts
  predictions on held-out data: a more honest, model-agnostic measure.
  Always compute it on test_df, not train_df, so it reflects
  generalization rather than memorization.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.inspection import permutation_importance

try:
    from .models import FEATURE_COLUMNS
except ImportError:  # running as a plain script from within src/
    from models import FEATURE_COLUMNS


def ridge_coefficients(ridge_pipeline, feature_cols: tuple[str, ...] = FEATURE_COLUMNS) -> pd.DataFrame:
    """Standardized coefficients from a fitted ridge pipeline (scaler + ridge).

    Coefficients act on standardized features, so magnitude is directly
    comparable across all 14 features regardless of their raw units.
    """
    ridge = ridge_pipeline.named_steps["ridge"]
    table = pd.Series(ridge.coef_, index=list(feature_cols)).rename("coefficient").to_frame()
    table["abs_coefficient"] = table["coefficient"].abs()
    return table.sort_values("abs_coefficient", ascending=False)


def gbm_permutation_importance(
    gbm_model,
    df: pd.DataFrame,
    target_col: str,
    feature_cols: tuple[str, ...] = FEATURE_COLUMNS,
    n_repeats: int = 10,
    random_state: int = 42,
) -> pd.DataFrame:
    """Permutation importance for a fitted GBM, measured on `df` (pass test_df).

    For each feature, shuffles its values n_repeats times and measures how
    much the model's error increases. A bigger increase means the model
    relied on that feature more.
    """
    result = permutation_importance(
        gbm_model,
        df[list(feature_cols)],
        df[target_col],
        n_repeats=n_repeats,
        random_state=random_state,
        scoring="neg_mean_absolute_error",
    )
    table = pd.DataFrame(
        {"importance_mean": result.importances_mean, "importance_std": result.importances_std},
        index=list(feature_cols),
    )
    return table.sort_values("importance_mean", ascending=False)


def importance_report(
    fitted_models: dict,
    test_df: pd.DataFrame,
    target_cols: tuple[str, ...] = ("sbp", "dbp"),
    feature_cols: tuple[str, ...] = FEATURE_COLUMNS,
    n_repeats: int = 10,
    random_state: int = 42,
) -> pd.DataFrame:
    """One combined table: ridge coefficient + gbm permutation importance, per feature/target.

    `fitted_models` is the dict returned by `train_and_compare` in models.py:
    {(target, "ridge"): pipeline, (target, "gbm"): model}
    """
    rows = []
    for target in target_cols:
        ridge_table = ridge_coefficients(fitted_models[(target, "ridge")], feature_cols)
        gbm_table = gbm_permutation_importance(
            fitted_models[(target, "gbm")], test_df, target, feature_cols,
            n_repeats=n_repeats, random_state=random_state,
        )
        combined = ridge_table.join(gbm_table)
        combined.insert(0, "target", target)
        combined.insert(1, "feature", combined.index)
        rows.append(combined.reset_index(drop=True))
    return pd.concat(rows, ignore_index=True)


if __name__ == "__main__":
    # Self-test: reuse the same synthetic data/models approach as models.py,
    # then check that the features we actually used to build sbp/dbp show up
    # as the most important for both ridge and gbm.
    # Run with: python src/importance.py
    from data_split import grouped_train_test_split
    from models import train_and_compare

    rng = np.random.default_rng(0)
    files = ["Part_1.mat", "Part_2.mat", "Part_3.mat", "Part_4.mat"]
    rows = []
    for file_name in files:
        for record_index in range(400):
            for _ in range(rng.integers(1, 20)):
                features = {col: rng.normal(0, 1) for col in FEATURE_COLUMNS}
                sbp = 120 + 8 * features["heart_rate_bpm"] - 5 * features["rise_fall_ratio"] + rng.normal(0, 10)
                dbp = 80 + 4 * features["pulse_height"] - 3 * features["rise_time_s"] + rng.normal(0, 7)
                rows.append({"file": file_name, "record_index": record_index,
                             "start_sample": 0, "sbp": sbp, "dbp": dbp, **features})
    fake_df = pd.DataFrame(rows)

    train_df, test_df = grouped_train_test_split(fake_df, test_size=0.2, random_state=42)
    _, fitted_models = train_and_compare(train_df, test_df)

    report = importance_report(fitted_models, test_df)
    pd.set_option("display.width", 120)
    for target in ("sbp", "dbp"):
        print(f"--- {target} ---")
        print(report[report["target"] == target].drop(columns="target").round(3).to_string(index=False))
        print()
