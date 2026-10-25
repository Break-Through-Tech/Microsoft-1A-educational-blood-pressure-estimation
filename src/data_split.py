"""Train/test splitting that keeps whole recordings together.

`ppg_features.csv` has many rows (5-second windows) coming from the same
recording. If windows from one recording end up in both train and test,
the model can "cheat" by learning that recording's quirks instead of
generalizing. This module splits by recording, not by row, so a given
recording is entirely in train or entirely in test.

A recording is identified by (file, record_index) — the same source ID
columns written by preprocess.ipynb and carried through ppg_features.csv.
"""

from __future__ import annotations

import pandas as pd
from sklearn.model_selection import GroupShuffleSplit

GROUP_COLS = ["file", "record_index"]


def grouped_train_test_split(
    df: pd.DataFrame,
    test_size: float = 0.2,
    random_state: int = 42,
    stratify_col: str | None = "file",
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Split a windows dataframe into train/test by whole recording.

    Args:
        df: dataframe with one row per window, including GROUP_COLS.
        test_size: fraction of *recordings* (not rows) to hold out.
        random_state: seed, for a reproducible split.
        stratify_col: if set, split within each value of this column
            separately and concatenate the results. Default "file" keeps
            Part_1..4 represented in roughly the same proportion in both
            train and test, instead of risking one source file landing
            mostly in one split by chance.

    Returns:
        (train_df, test_df), each a copy of the matching rows of df.
    """
    missing = [c for c in GROUP_COLS if c not in df.columns]
    if missing:
        raise ValueError(f"df is missing required column(s): {missing}")

    if stratify_col is None:
        groups = df[GROUP_COLS].astype(str).agg("|".join, axis=1)
        train_idx, test_idx = _split_indices(df.index, groups, test_size, random_state)
    else:
        train_idx, test_idx = [], []
        for _, chunk in df.groupby(stratify_col):
            groups = chunk[GROUP_COLS].astype(str).agg("|".join, axis=1)
            chunk_train_idx, chunk_test_idx = _split_indices(
                chunk.index, groups, test_size, random_state
            )
            train_idx.extend(chunk_train_idx)
            test_idx.extend(chunk_test_idx)

    train_df = df.loc[train_idx].reset_index(drop=True)
    test_df = df.loc[test_idx].reset_index(drop=True)
    _assert_no_group_leakage(train_df, test_df)
    return train_df, test_df


def _split_indices(index, groups, test_size, random_state):
    splitter = GroupShuffleSplit(n_splits=1, test_size=test_size, random_state=random_state)
    train_pos, test_pos = next(splitter.split(index, groups=groups))
    index_array = index.to_numpy()
    return index_array[train_pos].tolist(), index_array[test_pos].tolist()


def _assert_no_group_leakage(train_df: pd.DataFrame, test_df: pd.DataFrame) -> None:
    train_groups = set(train_df[GROUP_COLS].itertuples(index=False, name=None))
    test_groups = set(test_df[GROUP_COLS].itertuples(index=False, name=None))
    overlap = train_groups & test_groups
    if overlap:
        raise AssertionError(
            f"{len(overlap)} recording(s) leaked into both train and test: "
            f"{sorted(overlap)[:5]}..."
        )


def split_summary(train_df: pd.DataFrame, test_df: pd.DataFrame) -> pd.DataFrame:
    """Row/recording counts per split, overall and per source file."""
    rows = []
    for name, part in [("train", train_df), ("test", test_df)]:
        n_recordings = part[GROUP_COLS].drop_duplicates().shape[0]
        rows.append({"split": name, "rows": len(part), "recordings": n_recordings})
    return pd.DataFrame(rows)


if __name__ == "__main__":
    # Self-test with synthetic data shaped like ppg_features.csv, since the
    # real file is generated locally and gitignored. Run with:
    #   python src/data_split.py
    import numpy as np

    rng = np.random.default_rng(0)
    files = ["Part_1.mat", "Part_2.mat", "Part_3.mat", "Part_4.mat"]
    rows = []
    for file_name in files:
        n_recordings = 300
        for record_index in range(n_recordings):
            n_windows = rng.integers(1, 20)  # recordings vary in length
            for w in range(n_windows):
                rows.append(
                    {
                        "file": file_name,
                        "record_index": record_index,
                        "start_sample": w * 625,
                        "heart_rate_bpm": rng.normal(75, 10),
                        "sbp": rng.normal(120, 15),
                        "dbp": rng.normal(80, 10),
                    }
                )
    fake_df = pd.DataFrame(rows)

    train_df, test_df = grouped_train_test_split(fake_df, test_size=0.2, random_state=42)
    print(split_summary(train_df, test_df).to_string(index=False))
    print("No recording leaked across splits: OK")
