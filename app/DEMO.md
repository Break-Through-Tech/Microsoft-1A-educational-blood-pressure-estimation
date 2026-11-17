# Pulse2BP web demo

Open the published link in Chrome on an Android phone. Tap **Start capture**,
allow camera access, and rest your fingertip over the rear camera and flash
for 30 seconds. The page sends brightness samples to XGBoost and shows an
experimental blood pressure estimate.

## Run on your computer

From the repository root, run:

```powershell
python -m pip install -r app/requirements.txt
python app/server.py
```

Open `http://localhost:8765` to preview the page. Use the published HTTPS link
to test the rear camera and flash on your phone.

## Publish on Render

Create a Free Python Web Service in [Render](https://dashboard.render.com/)
using the public repository and the `pulse2bp-web-demo` branch. Leave the
root directory blank so the app can load the notebook's feature code.

| Setting | Value |
| --- | --- |
| Build command | `python -m pip install -r app/requirements.txt` |
| Start command | `PULSE2BP_HOST=0.0.0.0 OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python app/server.py` |
| `PYTHON_VERSION` | `3.12.12` |
| Health check path | `/health` |

Open the HTTPS link in Android Chrome to try a capture. A Free service can
take about a minute to start after sitting idle.

The deployment branch includes the two trained model files. To regenerate
them, install the repo's `requirements.txt`, put the four MATLAB files in
`data/`, and run `python app/export_models.py` from the repository root.
