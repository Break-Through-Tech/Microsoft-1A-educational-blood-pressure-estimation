
const SAMPLE_RATE = 25;
const MIN_SAMPLE_RATE = 14;
const MAX_FRAME_GAP = 0.4;

export function resampleColors(frames) {
  const start = frames[0]?.time;
  const end = frames.at(-1)?.time;
  const duration = end - start;
  if (!Number.isFinite(duration) || duration < 4 || (frames.length - 1) / duration < MIN_SAMPLE_RATE) {
    return null;
  }

  for (let i = 1; i < frames.length; i++) {
    const gap = frames[i].time - frames[i - 1].time;
    if (!(gap > 0 && gap <= MAX_FRAME_GAP)) return null;
  }

  const colors = [];
  let frame = 1;
  for (let i = 0; i <= Math.floor(duration * SAMPLE_RATE); i++) {
    const time = start + i / SAMPLE_RATE;
    while (frame < frames.length - 1 && frames[frame].time < time) frame++;
    const left = frames[frame - 1];
    const right = frames[frame];
    const fraction = (time - left.time) / (right.time - left.time);
    colors.push(left.rgb.map((value, channel) => value + fraction * (right.rgb[channel] - value)));
  }
  return colors;
}
