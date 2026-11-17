
import { captureFrames } from "./camera.js";
import { analyzePulse } from "./face-signal.js";

export const faceCamera = { facingMode: { ideal: "user" } };
export const forehead = { left: 0.40, top: 0.31, width: 0.20, height: 0.10 };

export async function captureFace(video, track, signal, duration, onFrame, onPulse) {
  const canvas = document.createElement("canvas");
  const size = 24;
  canvas.width = canvas.height = size;
  const pixels = canvas.getContext("2d", { willReadFrequently: true });
  const frames = [];
  let nextUpdate = 4;

  await captureFrames(video, track, signal, duration, time => {
    const { videoWidth: width, videoHeight: height } = video;
    pixels.drawImage(video, forehead.left * width, forehead.top * height,
      forehead.width * width, forehead.height * height, 0, 0, size, size);
    const data = pixels.getImageData(0, 0, size, size).data;
    frames.push({ time, rgb: averageColors(data) });
    onFrame(time);

    if (time >= nextUpdate && time < duration) {
      nextUpdate = time + 1;
      const recent = frames.filter(frame => frame.time >= time - 15);
      onPulse(analyzePulse(recent));
    }
  });
  // Use the last 15 seconds, matching the live preview window.
  const end = frames.at(-1).time;
  return analyzePulse(frames.filter(frame => frame.time >= end - 15));
}

function averageColors(data) {
  const rgb = [0, 0, 0];
  for (let i = 0; i < data.length; i += 4) {
    rgb[0] += data[i];
    rgb[1] += data[i + 1];
    rgb[2] += data[i + 2];
  }
  return rgb.map(sum => sum / (data.length / 4));
}
