"""Serve the Pulse2BP browser demo and its XGBoost predictions."""

import ast
import json
import os
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import numpy as np
import pandas as pd
from scipy.fft import rfft, rfftfreq
from scipy.signal import butter, filtfilt, find_peaks, welch, windows
from numpy.lib.stride_tricks import sliding_window_view
from itertools import combinations
from threadpoolctl import threadpool_limits
from xgboost import XGBRegressor


APP = Path(__file__).resolve().parent
MODEL_DIR = APP / "models"
WEB_FILES = {
    "/": ("index.html", "text/html; charset=utf-8"),
    "/capture.js": ("capture.js", "text/javascript; charset=utf-8"),
    "/camera.js": ("camera.js", "text/javascript; charset=utf-8"),
    "/finger.js": ("finger.js", "text/javascript; charset=utf-8"),
    "/style.css": ("style.css", "text/css; charset=utf-8"),
}


def load_feature_helpers():
    """Load only feature definitions from the checked-in training notebook."""
    wanted = {
        "waveform-features": {"WAVE_FEATURES", "waveform_features"},
        "beat-features": {"BEAT_NAMES", "PHASE", "beat_template", "add_template_history"},
        "preprocessing-code": {
            "FEATURES", "FS", "BAND", "MIN_PEAK_DISTANCE", "MIN_COMPLETE_BEATS",
            "FILTER_B", "inband_power_ratio", "extract_features",
        },
        "split-code": {"add_ppg_history"},
        "raw-features": {"raw_window_features"},
        "pattern-features": {"normalize_waveforms", "multiscale_patterns"},
    }
    notebook = json.loads((APP.parent / "notebooks/final.ipynb").read_text(encoding="utf-8"))
    scope = globals().copy()
    for cell in notebook["cells"]:
        names = wanted.get(cell["id"], set())
        tree = ast.parse("".join(cell["source"])) if names else None
        if tree is None:
            continue
        tree.body = [
            node for node in tree.body
            if (isinstance(node, ast.FunctionDef) and node.name in names)
            or (isinstance(node, ast.Assign) and any(
                isinstance(part, ast.Name) and part.id in names
                for target in node.targets for part in ast.walk(target)
            ))
        ]
        exec(compile(tree, cell["id"], "exec"), scope)
    missing = set.union(*wanted.values()) - scope.keys()
    if missing:
        raise RuntimeError(f"Missing notebook definitions: {sorted(missing)}")
    return scope


def extract_inputs(raw, helpers):
    """Build the feature row for the first 30-second window of a recording."""
    clean = filtfilt(helpers["FILTER_B"], helpers["FILTER_A"], raw).astype(np.float32)
    base = helpers["extract_features"](clean)
    if base is None:
        raise ValueError("No clear pulse found. Hold your fingertip still and try again.")
    names = helpers["FEATURES"]
    wave = helpers["waveform_features"](clean[None])[0]
    beat = helpers["beat_template"](clean)
    row = dict(zip(names, base))
    row.update(zip(helpers["WAVE_FEATURES"], wave))
    row.update(zip(helpers["BEAT_NAMES"], beat))
    row.update(file="camera", record_index=0, start_sample=0)
    frame, _ = helpers["add_ppg_history"](pd.DataFrame([row]), names)
    frame, _ = helpers["add_template_history"](frame, names, helpers["BEAT_NAMES"])
    optical = helpers["raw_window_features"](raw[None])
    frame = pd.concat([frame, optical], axis=1)
    normalized = helpers["normalize_waveforms"](clean[None, ::4].copy())
    frame, _ = helpers["multiscale_patterns"](frame, normalized)
    return frame


def camera_waveform(payload, helpers):
    times = np.asarray(payload["seconds"], dtype=float)
    light = np.asarray(payload["brightness"], dtype=float)
    if (times.ndim != 1 or light.shape != times.shape or not 450 <= len(times) <= 5000
            or not np.isfinite(times).all() or not np.isfinite(light).all()
            or np.any((light < 0) | (light > 1))):
        raise ValueError("Incomplete capture. Try again.")
    times = times - times[0]
    gaps = np.diff(times)
    if not 29.992 <= times[-1] <= 31 or np.any(gaps <= 0) or gaps.max() > 0.35:
        raise ValueError("The camera missed frames. Hold still and try again.")
    if np.mean((light < 0.01) | (light > 0.99)) > 0.1 or np.std(light) < 0.001:
        raise ValueError("The image was too dark, too bright, or too flat. Reposition your finger.")
    # More blood usually means less reflected light. Reverse the camera brightness trace.
    raw = np.interp(np.arange(3750) / 125, times, 1 - light).astype(np.float32)
    if helpers["inband_power_ratio"](raw[None])[0] < 0.6:
        raise ValueError("The pulse signal was noisy. Keep light contact and hold still.")
    return raw


class Predictor:
    def __init__(self):
        self.helpers = load_feature_helpers()
        if not (MODEL_DIR / "features.json").is_file():
            raise SystemExit("Model files are missing. Run python app/export_models.py first.")
        self.columns = json.loads((MODEL_DIR / "features.json").read_text())
        self.models = []
        for target in ("sbp", "dbp"):
            model = XGBRegressor(n_jobs=1)
            model.load_model(MODEL_DIR / f"{target}.ubj")
            if model.n_features_in_ != len(self.columns):
                raise RuntimeError(f"Feature list does not match the {target} model.")
            self.models.append(model)

    def predict(self, raw):
        frame = extract_inputs(raw, self.helpers)
        features = frame[self.columns].to_numpy(dtype=np.float32)
        if not np.isfinite(features).all():
            raise ValueError("Could not measure the pulse features. Try again.")
        sbp, dbp = (round(float(model.predict(features)[0])) for model in self.models)
        if sbp <= dbp:
            raise ValueError("The model returned an inconsistent estimate. Try again.")
        return {"sbp": sbp, "dbp": dbp}


class Handler(BaseHTTPRequestHandler):
    timeout = 15

    def send_json(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.partition("?")[0]
        if path == "/health":
            self.send_json(200, {"status": "ready"})
        elif path in WEB_FILES:
            name, content_type = WEB_FILES[path]
            body = (APP / "web" / name).read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_json(404, {})

    def do_POST(self):
        if self.path != "/estimate":
            self.send_json(404, {})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 180_000:
                raise ValueError("Invalid capture size.")
            payload = json.loads(self.rfile.read(length))
            raw = camera_waveform(payload, self.server.predictor.helpers)
            self.send_json(200, self.server.predictor.predict(raw))
        except (ValueError, KeyError, TypeError, TimeoutError) as error:
            self.send_json(400, {"error": str(error)})


if __name__ == "__main__":
    predictor = Predictor()
    host = os.environ.get("PULSE2BP_HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8765"))
    server = ThreadingHTTPServer((host, port), Handler)
    server.predictor = predictor
    print(f"Pulse2BP listening on {host}:{port}", flush=True)
    server.serve_forever()
