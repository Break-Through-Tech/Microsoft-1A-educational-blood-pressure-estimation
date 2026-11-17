
import assert from "node:assert/strict";
import test from "node:test";
import { lightingIssue, readLighting } from "../web/face-light.js";
import { checkSetup } from "../web/face-setup.js";

function frames(fps, light, issue = null) {
  return Array.from({ length: 2 * fps + 1 }, (_, i) => ({
    time: i / fps, light: light(i / fps), issue,
  }));
}

test("the lighting check catches deep shadows and clipped highlights", () => {
  assert.equal(lightingIssue(readLighting([9, 7, 5, 255])), "dark");
  assert.equal(lightingIssue(readLighting([255, 240, 225, 255])), "glare");
  assert.equal(lightingIssue(readLighting([57, 39, 32, 255])), null);
});

test("preview waits for stable exposure and reports slow frames", () => {
  assert.equal(checkSetup(frames(30, () => 75)), "ready");
  assert.equal(checkSetup(frames(30, time => 25 + time * 28)), "waiting");
  assert.equal(checkSetup(frames(10, () => 75)), "frames");
  assert.equal(checkSetup(frames(30, () => 8, "dark")), "dark");
});
