
import { captureFace, faceCamera } from "./face-camera.js";
import { setupMessages } from "./face-messages.js";
import { createFaceOverlay } from "./face-overlay.js";
import { waitForFaceReady } from "./face-preview.js";
import { prepareFaceSession } from "./face-session.js";
import { captureFinger, estimatePressure, fingerCamera } from "./finger.js";
import { drawWaveform } from "./pulse-chart.js";

const video = document.querySelector("#camera");
const preview = document.querySelector("#preview");
const drawFace = createFaceOverlay(document.querySelector("#sample-areas"));
const modes = document.querySelector("#modes");
const faceInstructions = document.querySelector("#face-instructions");
const fingerInstructions = document.querySelector("#finger-instructions");
const button = document.querySelector("#start");
const cancelButton = document.querySelector("#cancel");
const progress = document.querySelector("#progress");
const status = document.querySelector("#status");
const reading = document.querySelector("#reading");
const chart = document.querySelector("#pulse-chart");
const canvas = chart.querySelector("canvas");
const privacy = document.querySelector("#capture-privacy");
const duration = 30;
let active;

function faceSelected() {
  return modes.querySelector(":checked").value === "face";
}

function clearResult() {
  reading.hidden = true;
  reading.textContent = "";
  chart.hidden = true;
}

function showMode() {
  const face = faceSelected();
  faceInstructions.hidden = !face;
  fingerInstructions.hidden = face;
  button.textContent = face ? "Open camera" : "Start finger capture";
  privacy.textContent = face
    ? "Face video and pulse data stay in your browser."
    : "Only brightness samples and timestamps go to the demo server. Camera video stays on your phone.";
}

function resetControls() {
  modes.disabled = false;
  button.disabled = false;
  cancelButton.hidden = true;
  progress.hidden = true;
  preview.hidden = true;
  showMode();
}

function stopCamera(run) {
  run.stream?.getTracks().forEach(track => track.stop());
  if (video.srcObject === run.stream) video.srcObject = null;
}

function showReading(value, label) {
  reading.setAttribute("aria-label", label);
  reading.textContent = value;
  reading.hidden = false;
}

function showPulse(pulse) {
  chart.hidden = !pulse?.waveform.length;
  if (!chart.hidden) drawWaveform(canvas, pulse.waveform);
  if (!pulse || pulse.bpm === null) reading.hidden = true;
  else showReading(`${pulse.bpm} bpm`, "Estimated heart rate");
}

function showProgress(elapsed) {
  progress.hidden = false;
  progress.value = elapsed;
}

function setFaceSetup(run, state, frame, measure) {
  drawFace(frame.regions, frame.colors);
  const ready = state === "ready";
  button.textContent = "Measure pulse";
  button.disabled = !ready;
  run.measure = ready ? measure : undefined;
  const message = ready && run.faceSession.manual
    ? "Align your face with the guide, then tap Measure pulse."
    : setupMessages[state];
  if (status.textContent !== message) status.textContent = message;
}

async function start() {
  const run = { controller: new AbortController(), face: faceSelected() };
  const { signal } = run.controller;
  active = run;
  clearResult();
  modes.disabled = true;
  button.disabled = true;
  cancelButton.hidden = false;
  progress.value = 0;
  status.textContent = "Requesting camera access…";

  try {
    if (!navigator.mediaDevices?.getUserMedia || !video.requestVideoFrameCallback) {
      throw new Error("Open the HTTPS link in a current browser with camera access.");
    }
    const direction = run.face ? faceCamera : fingerCamera;
    run.stream = await navigator.mediaDevices.getUserMedia({
      video: { ...direction, width: { ideal: 640 }, frameRate: { ideal: 30 } },
      audio: false,
    });
    signal.throwIfAborted();
    const track = run.stream.getVideoTracks()[0];
    if (run.face) preview.hidden = false;
    video.srcObject = run.stream;
    await video.play();
    signal.throwIfAborted();

    if (run.face) {
      drawFace({}, {});
      status.textContent = "Preparing face tracking…";
      run.faceSession = await prepareFaceSession(signal);
      signal.throwIfAborted();
      await waitForFaceReady(video, track, signal, run.faceSession,
        (state, frame, measure) => setFaceSetup(run, state, frame, measure));
      signal.throwIfAborted();
      status.textContent = "Hold still and look at the camera.";
      const pulse = await captureFace(video, track, signal, duration, run.faceSession, (time, frame) => {
        showProgress(time);
        drawFace(frame.regions, frame.colors);
        const message = frame.issue ? setupMessages[frame.issue] : "Hold still and look at the camera.";
        if (status.textContent !== message) status.textContent = message;
      }, showPulse);
      if (!pulse) {
        clearResult();
        throw new Error("No steady pulse detected. Face a steady light and keep still, then try again.");
      }
      showPulse(pulse);
      status.textContent = "Estimated heart rate";
    } else {
      const payload = await captureFinger(video, track, signal, duration, message => {
        status.textContent = message;
      }, showProgress);
      stopCamera(run);
      status.textContent = "Estimating blood pressure…";
      const result = await estimatePressure(payload, signal);
      status.textContent = "Estimated blood pressure";
      showReading(`${result.sbp} / ${result.dbp} mmHg`, "Estimated blood pressure");
    }
  } catch (error) {
    if (active === run) {
      clearResult();
      status.textContent = cameraError(error, run.face);
    }
  } finally {
    stopCamera(run);
    run.faceSession?.close();
    if (active === run) {
      active = undefined;
      resetControls();
    }
  }
}

function cameraError(error, face) {
  if (error.name === "NotAllowedError") return "Allow camera access for this site, then try again.";
  if (error.name === "NotFoundError" || error.name === "OverconstrainedError") {
    return face ? "Connect a webcam and try again." : "Finger mode needs a rear camera and flash. Try Face mode.";
  }
  if (error.name === "NotReadableError") return "Close other apps using the camera, then try again.";
  return error.message;
}

function cancel() {
  if (!active) return;
  const run = active;
  active = undefined;
  run.controller.abort();
  stopCamera(run);
  clearResult();
  resetControls();
  status.textContent = "Capture stopped.";
}

modes.addEventListener("change", () => {
  showMode();
  clearResult();
  status.textContent = "";
});
button.addEventListener("click", () => {
  if (active?.measure) {
    const measure = active.measure;
    active.measure = undefined;
    button.disabled = true;
    measure();
  } else if (!active) {
    void start();
  }
});
cancelButton.addEventListener("click", cancel);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) cancel();
});
window.addEventListener("pagehide", cancel);
showMode();
