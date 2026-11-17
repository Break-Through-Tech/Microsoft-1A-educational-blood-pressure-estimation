
import assert from "node:assert/strict";
import test from "node:test";
import { captureFrames } from "../web/camera.js";

function fakeCamera() {
  let readFrame;
  return {
    video: {
      requestVideoFrameCallback(callback) {
        readFrame = callback;
        return 1;
      },
      cancelVideoFrameCallback() {
        readFrame = undefined;
      },
    },
    track: new EventTarget(),
    frame(time) {
      readFrame?.(0, { mediaTime: time });
    },
  };
}

test("capture uses the first frame as time zero and keeps the final frame", async () => {
  const camera = fakeCamera();
  const times = [];
  const signal = new AbortController().signal;
  const recording = captureFrames(camera.video, camera.track, signal, 2, time => times.push(time));
  for (const time of [18, 19, 20, 21]) camera.frame(time);
  await recording;
  assert.deepEqual(times, [0, 1, 2]);
});

test("cancel stops frame sampling", async () => {
  const camera = fakeCamera();
  const controller = new AbortController();
  const times = [];
  const recording = captureFrames(camera.video, camera.track, controller.signal, 30, time => times.push(time));
  camera.frame(11);
  controller.abort();
  camera.frame(12);
  await assert.rejects(recording, { name: "AbortError" });
  assert.deepEqual(times, [0]);
});

test("a closed camera stops the recording", async () => {
  const camera = fakeCamera();
  const signal = new AbortController().signal;
  const recording = captureFrames(camera.video, camera.track, signal, 30, () => {});
  camera.track.dispatchEvent(new Event("ended"));
  await assert.rejects(recording, /camera closed/);
});
