
import { captureFrames } from "./camera.js";

export const fingerCamera = { facingMode: { exact: "environment" } };

export async function captureFinger(video, track, signal, duration, onStatus, onFrame) {
  if (!track.getCapabilities?.().torch) {
    throw new Error("This rear camera can’t control the flash. Try Face mode.");
  }
  await track.applyConstraints({ advanced: [{ torch: true }] });
  if (track.getSettings().torch === false) {
    throw new Error("The flash didn’t turn on. Try again or use Face mode.");
  }

  onStatus("Rest your fingertip over the rear lens and flash…");
  await new Promise(resolve => setTimeout(resolve, 1800));
  signal.throwIfAborted();

  const canvas = document.createElement("canvas");
  const size = 24;
  canvas.width = canvas.height = size;
  const pixels = canvas.getContext("2d", { willReadFrequently: true });
  const seconds = [];
  const brightness = [];

  await captureFrames(video, track, signal, duration, elapsed => {
    const { videoWidth: width, videoHeight: height } = video;
    pixels.drawImage(video, width / 4, height / 4, width / 2, height / 2, 0, 0, size, size);
    const data = pixels.getImageData(0, 0, size, size).data;
    let red = 0;
    for (let i = 0; i < data.length; i += 4) red += data[i];
    seconds.push(elapsed);
    brightness.push(red / (size * size * 255));
    onFrame(elapsed);
  });
  return { seconds, brightness };
}

export async function estimatePressure(payload, signal, path = "/estimate") {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Could not estimate blood pressure. Try again.");
  return result;
}
