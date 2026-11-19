
import assert from "node:assert/strict";
import test from "node:test";
import { agreeOnPulse } from "../web/face-consensus.js";

const candidate = (bpm, quality) => ({ bpm, quality, waveform: [bpm] });

test("two matching regions beat a strongly disagreeing third region", () => {
  const result = agreeOnPulse([candidate(123, 0.95), candidate(75, 0.85), candidate(79, 0.70)]);
  assert.equal(result.bpm, 77);
  assert.deepEqual(result.waveform, [75]);
});

test("two separated estimates and one weak estimate produce no reading", () => {
  assert.equal(agreeOnPulse([candidate(75, 0.9), candidate(112, 0.85)]), null);
  assert.equal(agreeOnPulse([candidate(75, 0.55)]), null);
  assert.equal(agreeOnPulse([candidate(75, 0.8)]).bpm, 75);
});
