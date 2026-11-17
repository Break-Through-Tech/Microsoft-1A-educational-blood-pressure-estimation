
export async function loadFaceDetector() {
  const { FaceDetector, FilesetResolver } = await import("./vision/vision_bundle.mjs");
  const files = await FilesetResolver.forVisionTasks("/vision/wasm");
  return FaceDetector.createFromOptions(files, {
    baseOptions: { modelAssetPath: "/vision/blaze_face_short_range.tflite", delegate: "CPU" },
    runningMode: "VIDEO",
    minDetectionConfidence: 0.50,
  });
}
