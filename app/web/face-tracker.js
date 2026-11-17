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
  let result = { face: null, issue: "missing" };
  return {
    update(video, now) {
      if (now < nextDetection) return result;
      nextDetection = now + intervalMs;
      const { detections } = detector.detectForVideo(video, now);
      const face = normalizedFace(detections[0], video.videoWidth, video.videoHeight);
      const issue = detections.length > 1 ? "several" : positionIssue(face);
      result = { face, issue };
      return result;
    },
    close() {
      detector.close();
    },
  };
}
