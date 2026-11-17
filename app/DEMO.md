# Pulse2BP web demo

Open the published link in Chrome or another current browser.

- **Face** is the default and works with a laptop webcam or phone selfie camera.
  Sit facing a steady light. Open the camera, line up your forehead with the box,
  and select **Measure pulse**. The browser shows a pulse waveform and heart rate
  when the signal is steady. Face video and pulse samples stay in the browser.
- **Finger** requires a phone with a rear camera and flash that the browser can
  switch on. Cover both with one finger for 30 seconds. This mode sends brightness
  samples and timestamps to the demo server for an experimental XGBoost blood
  pressure estimate.

Face mode extracts a pulse using the [POS method](https://doi.org/10.1109/TBME.2016.2609282).
A face-based blood pressure estimate would need testing on face recordings paired
with reference cuff readings.

## Run on your computer

From the repository root, run:

```powershell
python -m pip install -r app/requirements.txt
python app/server.py
```

Open `http://localhost:8765` to try the webcam. Use the published HTTPS link
to test the rear camera and flash on your phone.

## Check the signal code

With Node.js 22 or later, run `node --test app/tests/*.test.mjs` from the
repository root.

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

Use **Manual Deploy → Deploy latest commit** after pushing to the deployment
branch. The Free service can take about a minute to start after sitting idle.

The deployment branch includes the two trained model files. To regenerate
them, install the repo's `requirements.txt`, put the four MATLAB files in
`data/`, and run `python app/export_models.py` from the repository root.
