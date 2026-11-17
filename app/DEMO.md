# Pulse2BP Android demo

Install `dist/Pulse2BP.apk` on an Android phone with a rear camera and flash. The
phone captures 30 seconds of fingertip brightness, and the computer runs both
XGBoost regressors. The app shows one estimated systolic and diastolic reading.
Camera estimates are experimental and need validation against reference readings.

## Run over USB

From the repository root, install the Python dependencies and start the service.

```powershell
python -m pip install -r app/requirements.txt
python app/server.py
```

On a phone with USB debugging enabled, connect the cable and run these commands
in another terminal with Android platform tools on your path.

```powershell
adb install -r app/dist/Pulse2BP.apk
adb reverse tcp:8765 tcp:8765
```

Open Pulse2BP, keep the default computer address `http://127.0.0.1:8765`, and tap
**Start capture**. Rest your fingertip lightly over the rear camera and flash.

## Rebuild from source

To build the APK on Windows, install Android SDK Platform 34 and Build Tools
35.0.0. Set `ANDROID_HOME` to the SDK and `JAVA_HOME` to a JDK, then run
`powershell -ExecutionPolicy Bypass -File app/build.ps1` from the repo root.

To regenerate the model files, install the repo's `requirements.txt`, put the
four MATLAB files in `data/`, and run `python app/export_models.py` from the repo
root. It uses the existing notebook's data split, features, and model settings.

Each capture uses the notebook's feature settings for the first window in a
recording. The camera trace is interpolated to the notebook's 125 Hz input grid.
That matches the expected input shape, while the original dataset used a
dedicated fingertip sensor.
