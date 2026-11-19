
import assert from "node:assert/strict";
import test from "node:test";
import { assessRegions } from "../web/face-samples.js";

const sample = (name, middle, upper, clipped = 0) => ({
  name, rgb: [middle, middle, middle], light: { middle, upper, clipped },
});

test("one usable cheek can pass the lighting check", () => {
  const result = assessRegions([sample("forehead", 120, 255, 0.6),
    sample("leftCheek", 12, 20), sample("rightCheek", 45, 65)]);
  assert.deepEqual(result, { issue: null, light: 45, colors: { rightCheek: [45, 45, 45] } });
});

test("the preview distinguishes dark areas from excessive glare", () => {
  assert.equal(assessRegions([sample("forehead", 12, 21)]).issue, "dark");
  assert.equal(assessRegions([sample("forehead", 190, 253, 0.65)]).issue, "glare");
});
