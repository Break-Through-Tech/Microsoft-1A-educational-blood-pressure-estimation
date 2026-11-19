
import assert from "node:assert/strict";
import test from "node:test";
import { gzipSync } from "node:zlib";
import { setTimeout as delay } from "node:timers/promises";

class Control extends EventTarget {
  hidden = true;
  style = {};

  click() {
    if (!this.disabled) this.dispatchEvent(new Event("click"));
  }

  setAttribute() {}
}

async function until(ready) {
  for (let i = 0; i < 200; i++) {
    if (ready()) return;
    await delay(15);
  }
  assert.fail("The capture did not reach the expected state");
}

test("FacePhys and face BP stay local while finger capture calls the server", async () => {
  const ids = [
    "camera", "preview", "sample-areas", "modes", "face-instructions", "finger-instructions",
    "face-pressure", "estimate-face", "face-pressure-status", "face-pressure-reading",
    "start", "cancel", "progress", "status", "reading", "pulse-chart", "capture-privacy",
  ];
  const ui = Object.fromEntries(ids.map(id => [id, new Control()]));
  const requests = [];
  const cameraRequests = [];
  let selected = "face";
  let frameCallback;
  let frameTime;
  let closed = 0;
  const canvas = {
    width: 640,
    height: 144,
    getContext() {
      return {
        clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, drawImage() {},
        getImageData() {
          const pulse = Math.sin(2 * Math.PI * 1.25 * frameTime);
          let colors = [158 - 6 * pulse, 0, 0];
          if (selected === "face") colors = frameTime < 2 ? [9, 7, 5] : [152, 113 + 4 * pulse, 87];
          return { data: new Uint8ClampedArray([...colors, 255]) };
        },
      };
    },
  };
  ui["sample-areas"].children = [];
  ui.modes.querySelector = () => ({ value: selected });
  ui["pulse-chart"].querySelector = () => canvas;
  Object.assign(ui.camera, {
    videoWidth: 640,
    videoHeight: 480,
    play: async () => {},
    requestVideoFrameCallback(callback) {
      frameCallback = callback;
      return 1;
    },
    cancelVideoFrameCallback() {
      frameCallback = undefined;
    },
  });
  globalThis.document = Object.assign(new EventTarget(), {
    querySelector: selector => ui[selector.slice(1)],
    createElement: () => ({ ...canvas }),
  });
  globalThis.window = new EventTarget();
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      async getUserMedia({ video, audio }) {
        cameraRequests.push(video.facingMode);
        assert.equal(audio, false);
        const track = Object.assign(new EventTarget(), {
          getCapabilities: () => ({ torch: selected === "finger" }),
          getSettings: () => ({ torch: selected === "finger" }),
          applyConstraints: async () => {},
          stop() {
            if (this.readyState !== "ended") closed++;
            this.readyState = "ended";
          },
        });
        return { getTracks: () => [track], getVideoTracks: () => [track] };
      },
    },
  });
  globalThis.Worker = class {
    constructor(path) { this.path = path; }
    postMessage(data) {
      queueMicrotask(() => {
        if (this.closed) return;
        if (this.path === "/local-bp/worker.js") {
          this.onmessage({ data: { result: { sbp: 112, dbp: 72 } } });
        } else if (data.type === "init") {
          this.onmessage({ data: { type: "initDone" } });
        } else if (data.type === "run") {
          const value = Math.sin(2 * Math.PI * 1.25 * data.payload.timestamp);
          this.onmessage({ data: { type: "result", payload: { value } } });
        }
      });
    }
    terminate() { this.closed = true; }
  };
  globalThis.fetch = async (path, options = {}) => {
    if (path.startsWith("/facephys/")) {
      return new Response(path.endsWith("state.gz") ? gzipSync("{}") : new Uint8Array([0]));
    }
    const { body } = options;
    requests.push({ path, ...JSON.parse(body) });
    return { ok: true, json: async () => ({ sbp: 112, dbp: 72 }) };
  };

  await import("../web/capture.js");
  assert.equal(ui.start.textContent, "Open camera");
  ui.start.click();
  await until(() => frameCallback);
  assert.equal(ui.preview.hidden, false);
  await feedFrames(1);
  assert.equal(ui.start.disabled, true);
  assert.match(ui.status.textContent, /Face a steady lamp or window/);
  await feedFrames(4.2, 31);
  assert.equal(ui.start.disabled, false);
  assert.equal(ui.start.textContent, "Measure pulse");
  ui.start.click();
  await feedFrames(4.3, 127);
  await until(() => frameCallback);
  await feedFrames(24, 130);
  assert.equal(ui["pulse-chart"].hidden, false);
  assert.match(ui.reading.textContent, /^7[3-7] bpm$/);
  assert.equal(requests.length, 0);
  await feedFrames(39, 721);
  await until(() => ui.status.textContent === "Estimated heart rate");
  assert.equal(closed, 1);
  assert.equal(requests.length, 0);
  assert.equal(ui["estimate-face"].hidden, false);
  ui["estimate-face"].click();
  await until(() => ui["face-pressure-reading"].textContent === "112 / 72 mmHg");
  assert.equal(requests.length, 0);
  assert.match(ui.reading.textContent, /bpm$/);
  requests.length = 0;

  selected = "finger";
  ui.modes.dispatchEvent(new Event("change"));
  assert.equal(ui.reading.hidden, true);
  assert.equal(ui["pulse-chart"].hidden, true);
  ui.start.click();
  await until(() => frameCallback);
  await feedFrames(30);
  await until(() => ui.status.textContent === "Estimated blood pressure");
  assert.equal(ui.reading.textContent, "112 / 72 mmHg");
  assert.deepEqual(cameraRequests, [{ ideal: "user" }, { exact: "environment" }]);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].path, "/estimate");
  assert.equal(requests[0].seconds.length, 901);
  assert.equal(requests[0].brightness.length, 901);
  assert.equal(closed, 2);

  async function feedFrames(seconds, firstFrame = 0) {
    for (let i = firstFrame; i <= seconds * 30; i++) {
      frameTime = i / 30;
      frameCallback?.(frameTime * 1000, { mediaTime: frameTime });
      for (let turn = 0; turn < 6; turn++) await Promise.resolve();
    }
  }
});
