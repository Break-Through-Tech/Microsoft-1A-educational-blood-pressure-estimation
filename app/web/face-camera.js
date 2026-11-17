
import { captureFrames } from "./camera.js";
import { createPulsePicker } from "./face-windows.js";

export const faceCamera = { facingMode: { ideal: "user" } };

export async function captureFace(video, track, signal, duration, session, onFrame, onPulse) {
  const frames = [];
  const picks = createPulsePicker();
  let nextFeedback = 0;

  await captureFrames(video, track, signal, duration, (time, now) => {
    const frame = session.read(video, now);
    frames.push({ time, colors: frame.colors });
    if (time >= nextFeedback) {
      nextFeedback = time + 0.25;
      onFrame(time, frame);
    }
    if (time < duration) {
      const pulse = picks.update(frames, time);
      if (pulse !== undefined) onPulse(pulse);
    }
  });
  const end = frames.at(-1).time;
  return picks.update(frames, end, true);
}
