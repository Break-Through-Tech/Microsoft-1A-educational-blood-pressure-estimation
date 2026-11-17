
const SAMPLE_RATE = 25;
const MIN_SAMPLE_RATE = 14;
const MAX_FRAME_GAP = 0.4;

function resampleColors(frames) {
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

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function deviation(values) {
  const center = mean(values);
  return Math.sqrt(mean(values.map(value => (value - center) ** 2)));
}

export function pulseWaveform(frames) {
  const colors = resampleColors(frames);
  if (!colors) return null;
  const brightness = mean(colors.map(rgb => mean(rgb)));
  if (!(brightness >= 8 && brightness <= 247)) return null;

  const waveform = projectPulse(colors);
  if (deviation(waveform) < 0.00025) return null;
  const smooth = movingAverage(waveform, 2);
  const baseline = movingAverage(smooth, Math.round(SAMPLE_RATE * 0.75));
  const filtered = smooth.map((value, i) => value - baseline[i]);
  return deviation(filtered) < 0.0002 ? null : filtered;
}

function projectPulse(colors) {
  // POS projects normalized RGB into two color differences to suppress shared brightness changes.
  const windowSize = Math.round(SAMPLE_RATE * 1.6);
  const sum = new Float64Array(colors.length);
  const count = new Uint16Array(colors.length);
  for (let start = 0; start + windowSize <= colors.length; start++) {
    const window = colors.slice(start, start + windowSize);
    const channelMeans = [0, 1, 2].map(channel => mean(window.map(rgb => rgb[channel])));
    if (channelMeans.some(value => !(value >= 1))) continue;

    const normalized = window.map(rgb => rgb.map((value, channel) => value / channelMeans[channel]));
    const first = normalized.map(([, green, blue]) => green - blue);
    const second = normalized.map(([red, green, blue]) => green + blue - 2 * red);
    const spread = deviation(second);
    const weight = spread > 1e-8 ? deviation(first) / spread : 0;
    const pulse = first.map((value, i) => value + weight * second[i]);
    const center = mean(pulse);

    for (let i = 0; i < windowSize; i++) {
      sum[start + i] += pulse[i] - center;
      count[start + i]++;
    }
  }
  return Array.from(sum, (value, i) => count[i] ? value / count[i] : 0);
}

function movingAverage(values, radius) {
  return values.map((_, i) => mean(values.slice(Math.max(0, i - radius), i + radius + 1)));
}
