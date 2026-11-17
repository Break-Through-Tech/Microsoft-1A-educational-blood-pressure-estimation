
export const MIN_CAMERA_FPS = 14;
export const MAX_FRAME_GAP = 0.4;

export function checkFrameTiming(frames) {
  if (frames.length < 2) return false;
  const duration = frames.at(-1).time - frames[0].time;
  if (!(duration > 0) || (frames.length - 1) / duration < MIN_CAMERA_FPS) return false;
  return frames.every((frame, index) => {
    if (index === 0) return true;
    const gap = frame.time - frames[index - 1].time;
    return gap > 0 && gap <= MAX_FRAME_GAP;
  });
}
