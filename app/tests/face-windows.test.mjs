
import assert from "node:assert/strict";
import test from "node:test";
import { createPulsePicker, readPulseWindow } from "../web/face-windows.js";

function scan(seconds, makeColors) {
  return Array.from({ length: seconds * 30 + 1 }, (_, i) => ({
    time: i / 30, colors: makeColors(i / 30),
  }));
}

function trace(time, rate, base = 110) {
  const pulse = Math.sin(2 * Math.PI * rate / 60 * time);
  return [base * 1.3 + pulse * 0.15, base + pulse * 0.9, base * 0.8 + pulse * 0.2];
}

test("the final result can come from a clean window before late movement", () => {
  const frames = scan(30, time => time < 17
    ? { forehead: trace(time, 77), rightCheek: trace(time, 77) } : {});
  assert.equal(readPulseWindow(frames, 30), null);
  const picker = createPulsePicker();
  assert.equal(picker.update(frames, 10), undefined);
  assert.ok(Math.abs(picker.update(frames, 14).bpm - 77) <= 2);
  assert.equal(picker.update(frames, 25), null);
  assert.ok(Math.abs(picker.update(frames, 30, true).bpm - 77) <= 2);
});

test("a clean cheek works under dim light when the other areas drop out", () => {
  const frames = scan(15, time => ({
    rightCheek: trace(time, 83, 39),
    leftCheek: time > 5 ? trace(time, 110) : undefined,
  }));
  const pulse = readPulseWindow(frames, 15);
  assert.ok(pulse && Math.abs(pulse.bpm - 83) <= 2);
});
