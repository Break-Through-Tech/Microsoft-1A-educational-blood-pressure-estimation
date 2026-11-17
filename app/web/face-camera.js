
import { captureFrames } from "./camera.js";
import { createPulsePicker } from "./face-windows.js";
import { agreeOnPulse } from "./face-consensus.js";
import { analyzePulse, pressureWaveform } from "./face-signal.js";

export function pressureCandidate(frames) {
  const end = frames.at(-1)?.time;
  if (!(end >= 30)) return null;
  const start = frames.findLastIndex(frame => frame.time <= end - 30);
  const window = frames.slice(Math.max(0, start));
  const candidates = ["forehead", "leftCheek", "rightCheek"].flatMap(area => {
    if (!window[0].colors[area] || !window.at(-1).colors[area]) return [];
    const samples = window.filter(frame => frame.colors[area])
      .map(frame => ({ time: frame.time, rgb: frame.colors[area] }));
    if (samples.length < window.length * 0.95) return [];
    const pulse = analyzePulse(samples);
    if (pulse.bpm === null) return [];
    const waveform = pressureWaveform(samples);
    return waveform ? [{ ...pulse, waveform }] : [];
  });
  return agreeOnPulse(candidates)?.waveform ?? null;
}

export const faceCamera = { facingMode: { ideal: "user" } };

export async function captureFace(video, track, signal, duration, session, onFrame, onPulse) {
  const frames = [];
  const picks = createPulsePicker();
  let nextFeedback = 0;
  let nextPressure = duration;
  let pressure;

  await captureFrames(video, track, signal, duration + 15, (time, now) => {
    const frame = session.read(video, now);
    frames.push({ time, colors: frame.colors });
    if (time >= nextFeedback) {
      nextFeedback = time + 0.25;
      onFrame(time, frame);
    }
    if (time >= nextPressure) {
      nextPressure = time + 2;
      pressure = pressureCandidate(frames);
      if (pressure) return true;
    }
    const pulse = picks.update(frames, time);
    if (pulse !== undefined) onPulse(pulse);
  });
  const end = frames.at(-1).time;
  return { pulse: picks.update(frames, end, true), pressure: pressure ?? pressureCandidate(frames) };
}
