# Notebook results

## [dataset_overview.ipynb](../notebooks/dataset_overview.ipynb)

**Purpose:** Explore the data.

### Findings

- There are **four files**.
- Each file holds **3,000 separate tables**. Each table is one recording.
- Each row contains three readings taken together:
  - **PPG:** Light measures changes in blood under the skin.
  - **ABP:** Measures blood pressure inside an artery.
  - **ECG:** Measures the heart's electrical activity.
- **125 rows make one second** of recording.
- Each recording can have a different length.
- A five-second piece contains **625 rows**.

### Signal graphs

![PPG, ABP, and ECG examples from the four files](graphs/signal_examples.png)

- The lines show how readings rise and fall over time.
- Moving from left to right means time is passing.
- Each row of graphs shows an example from one file.
- Each column shows one signal: PPG, ABP, or ECG.
- These graphs show five seconds from one recording in each file.

### Recording-length graph

![Recording lengths across the four files](graphs/recording_lengths.png)

- This graph shows how many recordings are short or long.
- Left means shorter recordings. Right means longer recordings.
- A taller bar means more recordings have that length.

## [preprocess.ipynb](../notebooks/preprocess.ipynb)

**Purpose:** Prepare the signals for training.

### Preprocessing steps

- Open one file at a time and read each recording.
- Take **625 rows** at a time to make five-second windows. Leave shorter leftovers unused.
- Skip windows with missing numbers or nearly flat PPG.
- Calculate **SBP from ABP high points** and **DBP from low points**, using the middle values. Require at least three of each, with SBP higher than DBP.
- Skip windows with **less than 60% power between 0.5 and 8 Hz**.
- Clean the accepted PPG with a 0.5–8 Hz filter to reduce slow drift and fast noise.
- Save the cleaned windows, blood-pressure labels, source IDs, power scores, and counts.

### Preprocessing diagram

![Preprocessing from recordings to saved windows](graphs/preprocessing_steps.png)

- Follow the arrows from top to bottom.
- A window that fails a check goes to “Skip window.”

### Findings

- Started with **528,828 complete five-second windows**.
- Rejected **22** with too few ABP high or low points.
- Rejected **10** where SBP was not higher than DBP.
- Rejected **1,324** remaining windows below the power cutoff.
- Kept **527,472 windows**.
- No windows were rejected for missing numbers or nearly flat PPG in this run.
- No fixed upper or lower blood-pressure limits were used.

### What we saved

- `data/processed_dataset.npz`: one file holding the cleaned PPG windows, SBP/DBP labels, source IDs, and power scores.
- **Source IDs:** the original file, recording number, and starting row for each window.
- [data_pipeline_stats.json](data_pipeline_stats.json): kept/rejected counts and the settings used.
