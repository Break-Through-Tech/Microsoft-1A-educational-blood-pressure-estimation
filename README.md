# Pulse2BP

---

### 👥 **Team Members**

**Example:**

| Name                | GitHub Username | Role / Contribution |
|---------------------|-----------------|---------------------|
| Clarisse Iradukunda | @Clarisse-I     | Model selection, hyperparameter tuning, model training and optimization |
| Hir Bhatt           | @Hir-11         | Model evaluation, performance analysis, results interpretation |
| Mashrafee Aryan     | @MashrafeeAryan | Pipeline integration, team coordination, dataset structure, train/test design |
| Sofial Alvazzi      | @sofiaal1       | Data exploration, visualization, overall project coordination |
| Sushmita Musunuri   | @sushmitam112   | Data collection, exploratory data analysis (EDA), dataset documentation |
| Vanesa Aguay Guerra | @vaguay | Signal segmentation, SBP/DBP label extraction, preprocessing support |
| Zaina Qadan         | @zaina778       | Data preprocessing, feature engineering, data validation |

---

## 🎯 **Project Highlights**

**Example:**

- Developed a machine learning model using `[model type/technique]` to address `[challenge project task]`.
- Achieved `[key metric or result]`, demonstrating `[value or impact]` for `[host company]`.
- Generated actionable insights to inform business decisions at `[host company or stakeholders]`.
- Implemented `[specific methodology]` to address industry constraints or expectations.

---

## 👩🏽‍💻 **Setup and Installation**

**Provide step-by-step instructions so someone else can run your code and reproduce your results. Depending on your setup, include:**

* How to clone the repository
* How to install dependencies
* How to set up the environment
* How to access the dataset(s)
* How to run the notebook or scripts

---

## 🏗️ **Project Overview**

**Describe:**

- How this project is connected to the Break Through Tech AI Program
- Your AI Studio host company and the project objective and scope
- The real-world significance of the problem and the potential impact of your work

---

## 📊 **Data Exploration**

### Dataset

We are using the **UCI Cuff-Less Blood Pressure Estimation dataset**. The dataset contains synchronized physiological signals that can be used to study cuffless blood pressure estimation.

Each recording contains three signals:

- **PPG (Photoplethysmography):** measures changes in blood volume
- **ABP (Arterial Blood Pressure):** provides the blood pressure waveform and is used as the ground truth
- **ECG (Electrocardiogram):** measures the electrical activity of the heart

The signals are sampled at **125 Hz**, meaning there are 125 data points per second.

The dataset is stored in large MATLAB `.mat` files using the MATLAB v7.3/HDF5 format. Because the files are large, the raw dataset is not stored directly in this GitHub repository.

### Data Exploration

We first explored the structure of the MATLAB files using Python and `h5py`.

Our exploration included:

- Opening the MATLAB/HDF5 files
- Finding the individual recordings stored inside each file
- Checking the shape and length of the recordings
- Confirming the PPG, ABP, and ECG signal columns
- Plotting small sections of each signal
- Checking how the three signals change over time

The recordings are long continuous signals, so they cannot be directly used as individual training examples. They will need to be divided into smaller time windows.

### Data Preprocessing

Our preprocessing pipeline is being developed to prepare the signals for machine learning.

The main steps include:

1. Load the PPG, ABP, and ECG signals.
2. Split the long signals into smaller matching time windows.
3. Check the PPG signal for missing, flat, or noisy data.
4. Clean and normalize the PPG signal when needed.
5. Use the ABP signal to calculate systolic blood pressure (SBP) and diastolic blood pressure (DBP).
6. Extract useful features from each PPG window.
7. Use the PPG features as model inputs and the SBP/DBP values as prediction targets.

The PPG and ABP windows must represent the same time period so that the PPG features are matched with the correct blood pressure values.

### Initial EDA Insights

Our initial exploration showed that:

- The dataset is made of long physiological waveforms rather than a normal row-and-column machine learning dataset.
- PPG, ABP, and ECG signals are recorded together and can be compared over the same time period.
- ABP contains repeating high and low points that can be used to obtain SBP and DBP.
- The long recordings need to be divided into smaller windows before feature extraction and model training.
- Signal quality is important because noisy or incorrect PPG sections could affect the model.

---

## 🧠 **Model Development**

- **Models:** Ridge regression (linear baseline) and gradient boosting (`HistGradientBoostingRegressor`), each trained separately for SBP and DBP — four models total, since gradient boosting in scikit-learn doesn't support multiple outputs at once.
- **Features:** 14 PPG-derived measurements per window (heart rate, pulse height, rise/fall time, pulse width, upslope, and PPG signal statistics) built in `ppg_feature_extraction.ipynb`. Ridge gets its features standardized first; gradient boosting uses them raw, since tree-based models don't need scaling.
- **Train/test split:** grouped 80/20 split **by whole recording** (`src/data_split.py`), so a recording's windows never land on both sides — this prevents the model from "cheating" on near-duplicate windows from a recording it already trained on.
- **Baseline:** a naive baseline (always predict the training set's mean SBP/DBP, ignoring every feature) sets the floor every real model has to beat.
- **Hyperparameter tuning:** grouped 5-fold cross-validation on the training set only (`src/cross_validation.py`), using `GroupKFold` on recording ID so a recording's windows stay in a single fold, the same way they do in the train/test split. The test set is never touched during this step.
  - Ridge: searched `alpha` over `[0.001, 0.01, 0.1, 1, 10, 100, 1000]` via a scikit-learn `Pipeline(StandardScaler, Ridge)`, so the scaler is refit on each fold's training data only.
  - Gradient boosting: searched `learning_rate`, `max_leaf_nodes`, and `min_samples_leaf` together (dozens of combinations), then widened that search once after noticing every winning combination sat at an edge of the grid — the wider search converged to essentially the same result, confirming the first search already found a real optimum rather than being cut short by the grid's boundaries.
- **Window-length experiment:** beyond the original 5-second windows, we tested two externally-cleaned datasets built from 20-second and 30-second windows (same 14-feature schema, more heartbeats averaged per window, but fewer total rows) to see whether longer windows improve prediction.

---

## 📈 **Results & Key Findings**

- The naive baseline alone accounts for most of the achievable error reduction (~18.5 mmHg MAE for SBP, ~9.2 mmHg for DBP on 5-second windows) — real signal from the PPG features has to beat that.
- **Gradient boosting consistently and meaningfully outperforms ridge** on both SBP and DBP, across all three window lengths tested — ridge only shaves a few percent off the naive baseline, while gradient boosting cuts MAE by 15-25%. This suggests the relationship between these PPG features and blood pressure isn't purely linear.
- **Window length matters, but longer isn't simply better.** Of the three lengths tested, **20-second windows** gave the lowest error — beating both the shorter 5-second windows and the longer 30-second windows:

  | Window | Rows | SBP MAE (tuned gradient boosting) | DBP MAE (tuned gradient boosting) |
  |---|---|---|---|
  | 5 seconds | 527,467 | 14.70 | 7.60 |
  | **20 seconds** | 128,460 | **13.30** | **7.03** |
  | 30 seconds | 83,419 | 13.83 | 7.10 |

  Longer windows average pulse measurements over more heartbeats (less noise per row), but also mean fewer independent windows per recording (less training data) — 20 seconds is the point where that trade-off is best for this dataset.
- **Feature importance is consistent across all three window lengths and both model types:** `pulse_height`, `max_upslope`, and `ppg_std` are the most influential features for predicting both SBP and DBP, in both ridge's standardized coefficients and gradient boosting's permutation importance.
- None of these results approach clinical accuracy (medical guidelines look for roughly 5 mmHg MAE or better) — that's expected for this educational pipeline rather than a clinically deployable model, and is documented honestly rather than overstated.
- Full per-notebook writeups, numbers, and graphs (model comparison bar charts, feature importance plots) are in [`results/README.md`](results/README.md).

---

## 🚀 **Next Steps**

**You might consider addressing the following (as applicable):**

* What are some of the limitations of your model?
* What would you do differently with more time/resources?
* What additional datasets or techniques would you explore?

---

## 📝 **License**

Specify how your project can be used by others. Choose an appropriate license and link it here (e.g., MIT, Apache 2.0). Make sure your Challenge Advisor approves of the selected license type. 

**Example:**
This project is licensed under the MIT License.

---

## 📄 **References** (Optional but encouraged)

Cite relevant papers, articles, or resources that supported your project.

---

## 🙏 **Acknowledgements** (Optional but encouraged)

Thank your Challenge Advisor, host company representatives, TA, and others who supported your project.
