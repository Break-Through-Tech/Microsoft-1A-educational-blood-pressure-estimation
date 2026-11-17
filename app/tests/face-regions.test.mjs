
import assert from "node:assert/strict";
import test from "node:test";
import { faceRegions, normalizedFace, positionIssue } from "../web/face-regions.js";

const detection = {
  boundingBox: { originX: 160, originY: 70, width: 320, height: 340 },
  keypoints: [{ x: 0.57, y: 0.38 }, { x: 0.43, y: 0.38 }, { x: 0.5, y: 0.52 }],
};

test("forehead and cheek areas move with the face", () => {
  const face = normalizedFace(detection, 640, 480);
  const original = faceRegions(face);
  const shifted = faceRegions(normalizedFace({
    ...detection, boundingBox: { ...detection.boundingBox, originX: 192 },
  }, 640, 480));
  assert.deepEqual(Object.keys(original), ["forehead", "leftCheek", "rightCheek"]);
  assert.ok(original.forehead.top + original.forehead.height < 0.38);
  for (const name of Object.keys(original)) {
    assert.ok(Math.abs(shifted[name].left - original[name].left - 0.05) < 1e-9);
  }
});

test("invalid framing and a far cheek can be skipped", () => {
  assert.equal(positionIssue(null), "missing");
  const face = normalizedFace(detection, 640, 480);
  assert.equal(positionIssue({ ...face, box: { ...face.box, width: 0.1 } }), "small");
  assert.equal(positionIssue({ ...face, box: { ...face.box, left: -0.1 } }), "edge");
  assert.equal(faceRegions({ ...face, nose: { x: 0.63 } }).rightCheek, undefined);
});
