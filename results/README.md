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
