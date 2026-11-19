
import { captureFrames } from "./camera.js";
import { analyzeWaveform } from "./face-signal.js";
import { loadFacePhys } from "./facephys.js";

export const faceCamera = { facingMode: { ideal: "user" } };

export async function captureFace(video, track, signal, duration, session, onFrame, onPulse) {
  const model = await loadFacePhys(signal);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 36;
  const pixels = canvas.getContext("2d", { willReadFrequently: true });
  const samples = [];
  let best = null;
  let nextUpdate = 5;
  let busy = false;
  let inference = Promise.resolve();
  let failure;
  try {
    // Let the recurrent model settle before retaining the 30-second waveform.
    await captureFrames(video, track, signal, duration + 3, (time, now) => {
      if (failure) throw failure;
      if (busy) return;
      const frame = session.read(video, now);
      onFrame(Math.max(0, time - 3), frame);
      if (!frame.box) return;
      const box = frame.box;
      const left = Math.max(0, box.left);
      const top = Math.max(0, box.top - box.height * 0.24);
      const width = Math.min(box.width, 1 - left);
      const height = Math.min(box.height * 1.2, 1 - top);
      pixels.drawImage(video, left * video.videoWidth, top * video.videoHeight,
        width * video.videoWidth, height * video.videoHeight, 0, 0, 36, 36);
      const data = pixels.getImageData(0, 0, 36, 36).data;
      const image = new Float32Array(36 * 36 * 3);
      for (let i = 0; i < data.length; i += 4) {
        for (let channel = 0; channel < 3; channel++) image[i / 4 * 3 + channel] = data[i + channel] / 255;
      }
      busy = true;
      inference = model.sample(image, time).then(value => {
        if (signal.aborted || time < 3) return;
        samples.push({ time: time - 3, value });
        if (time >= nextUpdate) {
          nextUpdate = time + 2;
          const pulse = analyzeWaveform(resamplePulse(samples.slice(-500), 15));
          if (pulse.bpm !== null) best = pulse;
          onPulse(pulse);
        }
      }).catch(error => { failure = error; }).finally(() => { busy = false; });
    });
    await inference;
    signal.throwIfAborted();
    if (failure) throw failure;
    const waveform = resamplePulse(samples, duration);
    const pulse = analyzeWaveform(waveform);
    return { pulse: pulse.bpm === null ? best : pulse, pressure: waveform };
  } finally {
    model.close();
  }
}

export function resamplePulse(samples, duration) {
  if (samples.length < 2) return null;
  const end = samples.at(-1).time;
  const start = Math.max(samples[0].time, end - duration);
  if (end - start < duration - 0.3) return null;
  const count = Math.round(duration * 25) + 1;
  let next = 1;
  const values = Array.from({ length: count }, (_, index) => {
    const time = start + index / (count - 1) * (end - start);
    while (next < samples.length - 1 && samples[next].time < time) next++;
    const a = samples[next - 1], b = samples[next];
    return a.value + (time - a.time) / (b.time - a.time) * (b.value - a.value);
  });
  const center = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.map(value => value - center);
}
