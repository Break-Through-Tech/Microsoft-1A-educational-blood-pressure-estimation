
import assert from "node:assert/strict";
import test from "node:test";
import { createFaceTracker } from "../web/face-tracker.js";

function detection(x = 160) {
  return { boundingBox: { originX: x, originY: 70, width: 320, height: 340 } };
}

test("tracking skips extra work and stops using a face that leaves the frame", () => {
  const calls = [];
  const detector = {
    detectForVideo(_, now) {
      calls.push(now);
      return { detections: now < 200 ? [detection()] : [] };
    },
    close() { calls.push("closed"); },
  };
  const tracker = createFaceTracker(detector);
  const video = { videoWidth: 640, videoHeight: 480 };
  assert.equal(tracker.update(video, 0).issue, null);
  assert.equal(tracker.update(video, 30).issue, null);
  assert.equal(tracker.update(video, 220).issue, "missing");
  tracker.close();
  assert.deepEqual(calls, [0, 220, "closed"]);
});

test("tracking waits after a sudden movement and flags multiple people", () => {
  const tracker = createFaceTracker({
    detectForVideo(_, now) {
      if (now >= 1000) return { detections: [detection(220), detection(20)] };
      return { detections: [detection(now < 200 ? 160 : 220)] };
    },
  });
  const video = { videoWidth: 640, videoHeight: 480 };
  assert.equal(tracker.update(video, 0).issue, null);
  assert.equal(tracker.update(video, 220).issue, "motion");
  assert.equal(tracker.update(video, 730).issue, null);
  assert.equal(tracker.update(video, 1050).issue, "several");
});
