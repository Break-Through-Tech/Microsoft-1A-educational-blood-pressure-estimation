
import { agreeOnPulse } from "./face-consensus.js";
import { analyzePulse } from "./face-signal.js";

const WINDOW_SECONDS = 14;
const AREAS = ["forehead", "leftCheek", "rightCheek"];

export function readPulseWindow(frames, end) {
  const window = frames.filter(frame => frame.time <= end && frame.time >= end - WINDOW_SECONDS);
  if (!window.length || window.at(-1).time - window[0].time < 12.5) return null;
  const candidates = AREAS.map(area => {
    const colors = window.filter(frame => frame.colors[area])
      .map(frame => ({ time: frame.time, rgb: frame.colors[area] }));
    if (colors.length < window.length * 0.88) return null;
    const pulse = analyzePulse(colors);
    if (pulse.bpm === null) return null;
    return { ...pulse, quality: pulse.quality * colors.length / window.length };
  }).filter(Boolean);
  return agreeOnPulse(candidates);
}
