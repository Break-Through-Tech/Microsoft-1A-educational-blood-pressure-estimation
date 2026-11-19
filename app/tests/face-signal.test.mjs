
import assert from "node:assert/strict";
import test from "node:test";
import { analyzePulse } from "../web/face-signal.js";

function samples(seconds, getColors, frameRate = 30) {
  return Array.from({ length: seconds * frameRate + 1 }, (_, i) => {
    const time = i / frameRate + 0.003 * Math.sin(i);
    return { time, rgb: getColors(time) };
  });
}

function colorsAtRate(bpm, time) {
  const pulse = Math.sin(2 * Math.PI * bpm / 60 * time);
  const light = 1 + 0.07 * Math.sin(2 * Math.PI * 0.28 * time);
  return [153, 116, 94].map((level, i) => light * level * (1 + [0.002, 0.009, 0.003][i] * pulse));
}

test("recovers pulse across common webcam frame rates", () => {
  for (const frameRate of [20, 30, 60]) {
    for (const expected of [52, 76, 118, 155]) {
      const result = analyzePulse(samples(15, time => colorsAtRate(expected, time), frameRate));
      assert.ok(result.waveform.length > 300);
      assert.ok(Number.isFinite(result.bpm) && Math.abs(result.bpm - expected) <= 3,
        `Expected ${expected} bpm at ${frameRate} FPS, got ${result.bpm}`);
    }
  }
});

test("rejects periodic changes that affect all three colors equally", () => {
  const frames = samples(15, time => {
    const light = 1 + 0.1 * Math.sin(2 * Math.PI * 1.2 * time);
    return [153 * light, 116 * light, 94 * light];
  });
  assert.deepEqual(analyzePulse(frames), { waveform: [], bpm: null });
});

test("waits for enough frames and rejects interrupted footage", () => {
  const color = time => colorsAtRate(74, time);
  assert.equal(analyzePulse(samples(6, color)).bpm, null);
  assert.equal(analyzePulse(samples(15, color, 10)).bpm, null);
  const interrupted = samples(15, color).filter(frame => frame.time < 6 || frame.time > 7);
  assert.equal(analyzePulse(interrupted).bpm, null);
});

test("does not report a rate when two parts of the signal disagree", () => {
  const frames = samples(15, time => colorsAtRate(time < 7.5 ? 70 : 124, time));
  assert.equal(analyzePulse(frames).bpm, null);
});
