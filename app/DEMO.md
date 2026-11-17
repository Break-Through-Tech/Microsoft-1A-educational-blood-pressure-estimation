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

## Publish on Replit

1. Run `python app/package_replit.py` to create `app/dist/Pulse2BP-Replit.zip`.
2. Sign in at [Replit Import](https://replit.com/import), choose ZIP, and upload
   `Pulse2BP-Replit.zip`.
3. Click **Run** to install the packages and start the app. Open its preview
   in a new tab to test it on your phone.
4. Publish it as a web app with an Autoscale deployment. Open the published
   link on Android Chrome and test one capture before the presentation.

The upload contains the two trained model files. To regenerate them, install
the repo's `requirements.txt`, put the four MATLAB files in `data/`, and run
`python app/export_models.py` from the repository root.
