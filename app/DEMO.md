# Pulse2BP web demo

Open the published link in Chrome or another current browser.

- **Face** is the default and works with a laptop webcam or phone selfie camera.
  Face a steady lamp or window and select **Open camera**. The preview tells you
  when lighting and framing are ready. Tap **Measure pulse**, then hold still
  for 30 seconds. FacePhys processes a cropped face video locally after a short startup.
  **Estimate blood pressure** runs the existing XGBoost trees and notebook
  features locally in your browser. Face video and pulse data stay on your device.
  The first estimate downloads Python, scientific packages and the BP trees,
  so it may take a minute. Repeat estimates can use browser download caches.
  If face tracking cannot load, line up your face yourself using the guide.
- **Finger** requires a phone with a rear camera and flash that the browser can
  switch on. Cover both with one finger for 30 seconds. This mode sends brightness
  samples and timestamps to the demo server for an experimental XGBoost blood
  pressure estimate.

Face tracking uses MediaPipe in the browser. The first visit downloads about
10 MB of tracker files and the browser can cache them for repeat visits.

Face mode uses [FacePhys](https://github.com/KegangWangCCNU/FacePhys-Demo).
Its license requires local processing and consent. Selecting **Open camera**
gives permission for this scan. Inference libraries load from jsDelivr.
FacePhys returns a relative pulse waveform. We center it and scale its
5th-to-95th percentile range to 0.1 at a level of 0.5 before the existing
feature pipeline. This scale is an experimental adapter, not a calibration.
Export browser BP files again with `python app/export_browser.py` if the
notebook or trained models change.
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


## Check the camera on real devices

Try a phone selfie camera and a laptop webcam. For each device, repeat the
30-second scan in normal light, dim light, and with a bright light behind you.
Try a scan with a small head movement near the end. Record how often the app
gives a reading and compare accepted heart rates with a fingertip pulse
oximeter. Check both measures across different lighting and skin tones.
