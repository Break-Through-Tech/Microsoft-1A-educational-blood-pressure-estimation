
import assert from "node:assert/strict";
import test from "node:test";
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

test("face capture stays local and finger capture calls the pressure model", async () => {
  const ids = [
    "camera", "preview", "forehead", "modes", "face-instructions", "finger-instructions",
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
          const colors = selected === "face" ? [152, 113 + 4 * pulse, 87] : [158 - 6 * pulse, 0, 0];
          return { data: new Uint8ClampedArray([...colors, 255]) };
        },
      };
    },
  };
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
  globalThis.fetch = async (path, { body }) => {
    requests.push({ path, ...JSON.parse(body) });
    return { ok: true, json: async () => ({ sbp: 112, dbp: 72 }) };
  };

  await import("../web/capture.js");
  assert.equal(ui.start.textContent, "Open camera");
  ui.start.click();
  await until(() => ui.start.textContent === "Measure pulse");
  assert.equal(ui.preview.hidden, false);
  ui.start.click();
  await until(() => frameCallback);
  feedFrames(15);
  assert.equal(ui["pulse-chart"].hidden, false);
  assert.match(ui.reading.textContent, /^7[3-7] bpm$/);
  assert.equal(requests.length, 0);
  feedFrames(30, 451);
  await until(() => ui.status.textContent === "Estimated heart rate");
  assert.equal(closed, 1);

  selected = "finger";
  ui.modes.dispatchEvent(new Event("change"));
  assert.equal(ui.reading.hidden, true);
  assert.equal(ui["pulse-chart"].hidden, true);
  ui.start.click();
  await until(() => frameCallback);
  feedFrames(30);
  await until(() => ui.status.textContent === "Estimated blood pressure");
  assert.equal(ui.reading.textContent, "112 / 72 mmHg");
  assert.deepEqual(cameraRequests, [{ ideal: "user" }, { exact: "environment" }]);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].path, "/estimate");
  assert.equal(requests[0].seconds.length, 901);
  assert.equal(requests[0].brightness.length, 901);
  assert.equal(closed, 2);

  function feedFrames(seconds, firstFrame = 0) {
    for (let i = firstFrame; i <= seconds * 30; i++) {
      frameTime = i / 30;
      frameCallback?.(0, { mediaTime: frameTime });
    }
  }
});
