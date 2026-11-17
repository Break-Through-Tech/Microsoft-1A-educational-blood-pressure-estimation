import { captureFrames } from "/camera.js";

const video = document.querySelector("#camera");
const button = document.querySelector("#start");
const progress = document.querySelector("#progress");
const status = document.querySelector("#status");
const reading = document.querySelector("#reading");
const canvas = document.createElement("canvas");
canvas.width = canvas.height = 24;
const pixels = canvas.getContext("2d", { willReadFrequently: true });
const duration = 30;
let active;

function stopCamera(run) {
  run.stream?.getTracks().forEach(track => track.stop());
  if (video.srcObject === run.stream) video.srcObject = null;
}

async function capture(track, signal) {
  const seconds = [];
  const brightness = [];
  await captureFrames(video, track, signal, duration, elapsed => {
    const width = video.videoWidth;
    const height = video.videoHeight;
    pixels.drawImage(video, width / 4, height / 4, width / 2, height / 2, 0, 0, 24, 24);
    const data = pixels.getImageData(0, 0, 24, 24).data;
    let red = 0;
    for (let i = 0; i < data.length; i += 4) red += data[i];
    seconds.push(elapsed);
    brightness.push(red / (24 * 24 * 255));
    progress.value = elapsed;
    const message = `Hold still · ${Math.min(duration, Math.floor(elapsed))} / 30 seconds`;
    if (status.textContent !== message) status.textContent = message;
  });
  return { seconds, brightness };
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
      video: { facingMode: { exact: "environment" }, width: { ideal: 640 }, frameRate: { ideal: 30 } },
      audio: false,
    });
    signal.throwIfAborted();
    const track = run.stream.getVideoTracks()[0];
    video.srcObject = run.stream;
    await video.play();
    signal.throwIfAborted();
    if (!track.getCapabilities?.().torch) {
      throw new Error("Chrome couldn’t control the rear flashlight on this device. Try another Android phone.");
    }
    await track.applyConstraints({ advanced: [{ torch: true }] });
    if (track.getSettings().torch === false) {
      throw new Error("The flashlight didn’t turn on. Try again.");
    }
    status.textContent = "Rest your fingertip over the camera and flash…";
    await new Promise(resolve => setTimeout(resolve, 1800));
    signal.throwIfAborted();
    progress.hidden = false;
    const payload = await capture(track, signal);
    stopCamera(run);
    status.textContent = "Estimating blood pressure…";
    const response = await fetch("/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not estimate blood pressure. Try again.");
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
