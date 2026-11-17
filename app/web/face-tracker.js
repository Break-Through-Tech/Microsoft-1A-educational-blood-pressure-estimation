import { normalizedFace, positionIssue } from "./face-regions.js";

export async function loadFaceDetector() {
  const { FaceDetector, FilesetResolver } = await import("./vision/vision_bundle.mjs");
  const files = await FilesetResolver.forVisionTasks("/vision/wasm");
  return FaceDetector.createFromOptions(files, {
    baseOptions: { modelAssetPath: "/vision/blaze_face_short_range.tflite", delegate: "CPU" },
    runningMode: "VIDEO",
    minDetectionConfidence: 0.50,
  });
}

export function createFaceTracker(detector) {
  const intervalMs = 170;
  let nextDetection = -Infinity;
  let previous;
  let settled;
  let holdUntil = -Infinity;
  let result = { face: null, issue: "missing" };
  return {
    update(video, now) {
      if (now < nextDetection) return result;
      nextDetection = now + intervalMs;
      const { detections } = detector.detectForVideo(video, now);
      const face = normalizedFace(detections[0], video.videoWidth, video.videoHeight);
      const issue = detections.length > 1 ? "several" : positionIssue(face);
      if (issue) {
        previous = undefined;
        settled = undefined;
        result = { face, issue };
        return result;
      }
      if (previous && changedQuickly(previous, face)) {
        holdUntil = now + 450;
        settled = undefined;
      }
      previous = face;
      settled = settled ? smoothFace(settled, face) : face;
      result = { face: settled, issue: now < holdUntil ? "motion" : null };
      return result;
    },
    close() {
      detector.close();
    },
  };
}

function changedQuickly(previous, current) {
  const a = previous.box;
  const b = current.box;
  const translation = Math.hypot(a.left + a.width / 2 - b.left - b.width / 2,
    a.top + a.height / 2 - b.top - b.height / 2);
  const resize = Math.max(Math.abs(a.width - b.width), Math.abs(a.height - b.height));
  return translation > a.width * 0.10 || resize > a.width * 0.16;
}

function smoothFace(previous, current) {
  const blend = (a, b) => a * 0.40 + b * 0.60;
  const point = (a, b) => a && b ? { x: blend(a.x, b.x), y: blend(a.y, b.y) } : b;
  const box = Object.fromEntries(Object.entries(current.box).map(([key, value]) =>
    [key, blend(previous.box[key], value)]));
  return {
    box,
    eyes: current.eyes.map((eye, i) => point(previous.eyes[i], eye)),
    nose: point(previous.nose, current.nose),
  };
}
