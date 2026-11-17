
import { checkFrameTiming } from "./face-timing.js";

export const SETUP_SECONDS = 1.6;

export function checkSetup(frames) {
  const latest = frames.at(-1);
  if (!latest) return "waiting";
  if (latest.issue) return latest.issue;
  const recent = frames.filter(frame => latest.time - frame.time <= SETUP_SECONDS);
  if (latest.time - recent[0].time < SETUP_SECONDS - 0.20) return "waiting";
  if (!checkFrameTiming(recent)) return "frames";

  const clean = recent.filter(frame => !frame.issue);
  if (clean.length < recent.length * 0.9) return "waiting";
  const quarter = Math.max(1, Math.floor(clean.length / 4));
  const average = list => list.reduce((sum, frame) => sum + frame.light, 0) / list.length;
  const before = average(clean.slice(0, quarter));
  const after = average(clean.slice(-quarter));
  if (Math.abs(before - after) > Math.max(7, before * 0.12)) return "waiting";
  return "ready";
}
