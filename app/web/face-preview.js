
import { captureFrames } from "./camera.js";
import { checkSetup, SETUP_SECONDS } from "./face-setup.js";

export async function waitForFaceReady(video, track, signal, session, onSetup) {
  let requested = false;
  let started = false;
  let nextUpdate = 0;
  let priorState;
  const recent = [];
  const requestCapture = () => { requested = true; };

  await captureFrames(video, track, signal, 60, (time, now) => {
    const frame = session.read(video, now);
    recent.push({ time, light: frame.light, issue: frame.issue });
    while (recent[0].time < time - SETUP_SECONDS) recent.shift();
    const state = checkSetup(recent);

    if (requested && state === "ready") {
      started = true;
      return true;
    }
    requested = false;
    if (time >= nextUpdate || state !== priorState) {
      nextUpdate = time + 0.25;
      priorState = state;
      onSetup(state, frame, requestCapture);
    }
    return false;
  });
  if (!started) throw new Error("Camera preview timed out. Open it again to retry.");
}
