#!/bin/bash
set -uo pipefail
cd /Users/sofiaalvazzi/Documents/Microsoft-1A-educational-blood-pressure-estimation/data
LOG=pipeline.log
echo "=== Resuming download at $(date) ===" >> "$LOG"
curl -L --max-time 10800 --retry 5 --retry-delay 5 --retry-all-errors -o raw_dataset.zip \
  "https://archive.ics.uci.edu/static/public/340/cuff+less+blood+pressure+estimation.zip" >> "$LOG" 2>&1
if [ $? -ne 0 ]; then echo "DOWNLOAD FAILED" >> "$LOG"; exit 1; fi
echo "=== Download complete at $(date) ===" >> "$LOG"
ls -la raw_dataset.zip >> "$LOG"

echo "=== Extracting at $(date) ===" >> "$LOG"
rm -rf extracted
unzip -o raw_dataset.zip -d extracted >> "$LOG" 2>&1

echo "=== Flattening Part_*.mat into data/ ===" >> "$LOG"
find extracted -iname "Part_*.mat" -exec cp {} . \;
ls -la Part_*.mat >> "$LOG" 2>&1
if ! ls Part_1.mat Part_2.mat Part_3.mat Part_4.mat >/dev/null 2>&1; then
  echo "MISSING EXPECTED .mat FILES" >> "$LOG"
  find extracted -iname "*.mat" >> "$LOG"
  exit 1
fi
rm -f raw_dataset.zip
rm -rf extracted

echo "=== Running preprocess.ipynb at $(date) ===" >> "$LOG"
cd ../notebooks
/opt/anaconda3/bin/jupyter nbconvert --to notebook --execute --inplace \
  --ExecutePreprocessor.timeout=3600 preprocess.ipynb >> ../data/"$LOG" 2>&1
if [ $? -ne 0 ]; then echo "PREPROCESS FAILED" >> ../data/"$LOG"; exit 1; fi
echo "=== preprocess.ipynb done at $(date) ===" >> ../data/"$LOG"

echo "=== Running ppg_feature_extraction.ipynb at $(date) ===" >> ../data/"$LOG"
/opt/anaconda3/bin/jupyter nbconvert --to notebook --execute --inplace \
  --ExecutePreprocessor.timeout=3600 ppg_feature_extraction.ipynb >> ../data/"$LOG" 2>&1
if [ $? -ne 0 ]; then echo "FEATURE EXTRACTION FAILED" >> ../data/"$LOG"; exit 1; fi
echo "=== ppg_feature_extraction.ipynb done at $(date) ===" >> ../data/"$LOG"

echo "=== Running modeling.ipynb at $(date) ===" >> ../data/"$LOG"
/opt/anaconda3/bin/jupyter nbconvert --to notebook --execute --inplace \
  --ExecutePreprocessor.timeout=3600 modeling.ipynb >> ../data/"$LOG" 2>&1
if [ $? -ne 0 ]; then echo "MODELING FAILED" >> ../data/"$LOG"; exit 1; fi
echo "=== modeling.ipynb done at $(date) ===" >> ../data/"$LOG"

echo "=== PIPELINE_DONE_MARKER at $(date) ===" >> ../data/"$LOG"
