
import { createExposureCheck } from "./face-exposure.js";
import { manualFace } from "./face-regions.js";
import { createFaceSampler } from "./face-samples.js";
import { createFaceTracker, loadFaceDetector } from "./face-tracker.js";

export async function prepareFaceSession(signal) {
  let timer;
  let expired = false;
  const fallback = new Promise(resolve => {
    timer = setTimeout(() => {
      expired = true;
      resolve(null);
    }, 10000);
  });
  const loading = loadFaceDetector().then(detector => {
    if (expired || signal.aborted) {
      detector.close();
      return null;
    }
    return detector;
  }).catch(() => null);
  const detector = await Promise.race([loading, fallback]);
  clearTimeout(timer);
  if (signal.aborted) {
    detector?.close();
    signal.throwIfAborted();
  }
  return createFaceSession(detector);
}

export function createFaceSession(detector) {
  const tracker = detector ? createFaceTracker(detector) : null;
  const sample = createFaceSampler();
  const exposureChanging = createExposureCheck();
  return {
    manual: !tracker,
    read(video, now) {
      const tracked = tracker?.update(video, now) ?? { face: manualFace, issue: null };
      const frame = sample(video, tracked);
      if (!frame.issue && exposureChanging(now / 1000, frame.light)) {
        return { ...frame, issue: "waiting", colors: {} };
      }
      return frame;
    },
    close() {
      tracker?.close();
    },
  };
}
