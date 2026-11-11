# Pulse2BP

---

### 👥 **Team Members**

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

- Estimate systolic (SBP) and diastolic (DBP) blood pressure from a fingertip pulse signal.
- Compare XGBoost and Extra Trees with a simple training-median baseline.
- XGBoost scored **11.60 mmHg SBP MAE** and **6.04 mmHg DBP MAE** on the 30-second test windows. [Final notebook](notebooks/final.ipynb)

---

## 👩🏽‍💻 **Setup and Installation**

1. Clone or download the repository and open a terminal at its root.
2. Install the packages with `python -m pip install -r requirements.txt`.
3. Download and extract `Part_1.mat` through `Part_4.mat` into the repository's `data/` folder. [UCI dataset](https://archive.ics.uci.edu/dataset/340/cuff+less+blood+pressure+estimation)
4. Run `jupyter notebook`, open `notebooks/final.ipynb`, and run the cells in order. Full training can take substantial CPU time.

---

## 🏗️ **Project Overview**

Pulse2BP is an educational prototype built for the Microsoft challenge in Break Through Tech AI Studio. It shows how machine learning can use an optical pulse signal (PPG) to estimate blood pressure.

---

## 📊 **Data Exploration**

### Dataset

The UCI dataset contains synchronized fingertip PPG, arterial blood pressure (ABP), and ECG sampled at 125 Hz. The four raw files are in MATLAB format. [UCI dataset](https://archive.ics.uci.edu/dataset/340/cuff+less+blood+pressure+estimation)

### Data Exploration

We checked recording lengths and plotted examples of the three signals. [Data exploration graphs](results/README.md)

### Data Preprocessing

We split the recordings into windows, filter the PPG, and extract pulse features. The high and low points of the matching ABP waveform provide the SBP and DBP labels.

### Initial EDA Insights

Recording lengths vary, so we use fixed windows for training. Flat or noisy PPG windows can hide the pulse shape and are screened during preprocessing.

---

## 🧠 **Model Development**

XGBoost is our final model. One regressor predicts SBP and another predicts DBP. Both use pulse measurements, waveform patterns, and earlier PPG windows from the same recording. We compare XGBoost with Extra Trees and a baseline that predicts the median BP from training.

We keep each recording in one split and check for duplicate inputs across splits. We use validation data to choose settings, then report test results for all three approaches.

---

## 📈 **Results & Key Findings**

All three approaches below used the same 12,523 test windows, each 30 seconds long. Mean absolute error (MAE) measures the average size of a prediction error.

| Model | SBP MAE | DBP MAE |
| --- | ---: | ---: |
| Training median | 18.29 mmHg | 8.59 mmHg |
| Extra Trees | 12.49 mmHg | 6.62 mmHg |
| XGBoost | **11.60 mmHg** | **6.04 mmHg** |

Section 4 compares the models in a chart and table. Section 5 shows which pulse features XGBoost used most. [Final notebook](notebooks/final.ipynb) · [Results guide](results/README.md)

---

## 🚀 **Next Steps**

The dataset identifies recordings. Patient IDs are unavailable. A dataset with patient IDs would let us check how well the model works for people it has never seen. Testing on another device would show how well the model transfers to a different PPG sensor.

---

## 📝 **License**

Pulse2BP is released under the [MIT License](LICENSE).

---

## 📄 **References** (Optional but encouraged)

- [UCI Cuff-Less Blood Pressure Estimation dataset](https://archive.ics.uci.edu/dataset/340/cuff+less+blood+pressure+estimation)
- [Challenge project overview](docs/Challenge-Project-Overview.md)
- [XGBoost paper](https://arxiv.org/abs/1603.02754)

---

## 🙏 **Acknowledgements** (Optional but encouraged)

Thanks to the Microsoft challenge team and the Break Through Tech AI Studio coaches for supporting this project.
