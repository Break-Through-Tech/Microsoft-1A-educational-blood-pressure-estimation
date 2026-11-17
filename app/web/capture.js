import { captureFinger, estimatePressure, fingerCamera } from "/finger.js";

const video = document.querySelector("#camera");
const button = document.querySelector("#start");
const progress = document.querySelector("#progress");
const status = document.querySelector("#status");
const reading = document.querySelector("#reading");
const duration = 30;
let active;

function stopCamera(run) {
  run.stream?.getTracks().forEach(track => track.stop());
  if (video.srcObject === run.stream) video.srcObject = null;
}

async function start() {
  const run = { controller: new AbortController() };
  const { signal } = run.controller;
  active = run;
  button.textContent = "Cancel";
  progress.hidden = true;
  progress.value = 0;
  reading.hidden = true;
  reading.textContent = "";
  status.textContent = "Requesting camera access…";
  try {
    if (!navigator.mediaDevices?.getUserMedia || !video.requestVideoFrameCallback) {
      throw new Error("Open this HTTPS link in Chrome on Android to use the camera.");
    }
    run.stream = await navigator.mediaDevices.getUserMedia({
      video: { ...fingerCamera, width: { ideal: 640 }, frameRate: { ideal: 30 } },
      audio: false,
    });
    signal.throwIfAborted();
    const track = run.stream.getVideoTracks()[0];
    video.srcObject = run.stream;
    await video.play();
    signal.throwIfAborted();
    const payload = await captureFinger(video, track, signal, duration, message => {
      status.textContent = message;
    }, elapsed => {
      progress.hidden = false;
      progress.value = elapsed;
      const message = `Hold still · ${Math.min(duration, Math.floor(elapsed))} / ${duration} seconds`;
      if (status.textContent !== message) status.textContent = message;
    });
    stopCamera(run);
    status.textContent = "Estimating blood pressure…";
    const result = await estimatePressure(payload, signal);
    status.textContent = "Estimated blood pressure";
    reading.textContent = `${result.sbp} / ${result.dbp} mmHg`;
    reading.hidden = false;
  } catch (error) {
    if (signal.aborted) status.textContent = "Capture stopped.";
    else if (error.name === "NotAllowedError") status.textContent = "Allow camera access for this site in Chrome and try again.";
    else if (error.name === "NotFoundError" || error.name === "OverconstrainedError") status.textContent = "A rear camera is required. Open this link on an Android phone.";
    else status.textContent = error.message;
  } finally {
    stopCamera(run);
    active = undefined;
    button.textContent = "Start capture";
    progress.hidden = true;
  }
}

button.addEventListener("click", () => {
  if (active) {
    active.controller.abort();
    stopCamera(active);
    status.textContent = "Capture stopped.";
  } else {
    void start();
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && active) {
    active.controller.abort();
    stopCamera(active);
  }
});
