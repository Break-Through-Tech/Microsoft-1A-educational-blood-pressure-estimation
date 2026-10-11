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

**You might consider describing the following (as applicable):**

* Model(s) used (e.g., CNN with transfer learning, regression models)
* Feature selection and Hyperparameter tuning strategies
* Training setup (e.g., % of data for training/validation, evaluation metric, baseline performance)


---

## 📈 **Results & Key Findings**

**You might consider describing the following (as applicable):**

* Performance metrics (e.g., Accuracy, F1 score, RMSE)
* How your model performed
* Insights from evaluating model fairness

**Potential visualizations to include:**

* Confusion matrix, precision-recall curve, feature importance plot, prediction distribution, outputs from fairness or explainability tools

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
