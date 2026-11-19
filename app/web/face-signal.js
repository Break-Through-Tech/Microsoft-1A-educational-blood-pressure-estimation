import { checkFrameTiming } from "./face-timing.js";


const SAMPLE_RATE = 25;

function resampleColors(frames) {
  const start = frames[0]?.time;
  const end = frames.at(-1)?.time;
  const duration = end - start;
  if (!(duration >= 4) || !checkFrameTiming(frames)) return null;

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

// Keep the pulse shape and restore a camera light level for the existing feature code.
export function pressureWaveform(frames) {
  // Fill missing frames on the model's fixed time grid using the selected face area.
  let next = 1;
  const colors = Array.from({ length: 751 }, (_, i) => {
    const time = i / SAMPLE_RATE;
    while (next < frames.length - 1 && frames[next].time < time) next++;
    const left = frames[next - 1];
    const right = frames[next];
    const weight = Math.max(0, Math.min(1, (time - left.time) / (right.time - left.time)));
    return left.rgb.map((value, channel) => value + weight * (right.rgb[channel] - value));
  });
  const light = mean(colors.map(rgb => rgb[1])) / 255;
  const pulse = projectPulse(colors.slice(0, 751));
  // Remove slow drift. A three-point weighted filter reduces camera noise.
  const baseline = movingAverage(pulse, SAMPLE_RATE * 2);
  const centered = pulse.map((value, i) => value - baseline[i]);
  const waveform = centered.map((value, i) => light * (1 - (
    centered[Math.max(0, i - 1)] + 2 * value + centered[Math.min(i + 1, 750)]
  ) / 4));
  return waveform.map(value => Math.max(0, Math.min(1, value)));
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

const MIN_HEART_RATE_SAMPLES = SAMPLE_RATE * 12;

export function analyzePulse(frames) {
  return analyzeWaveform(pulseWaveform(frames));
}

export function analyzeWaveform(waveform) {
  if (!waveform) return { waveform: [], bpm: null };
  if (waveform.length < MIN_HEART_RATE_SAMPLES) return { waveform, bpm: null };

  const whole = strongestFrequency(waveform);
  const middle = Math.floor(waveform.length / 2);
  const first = strongestFrequency(waveform.slice(0, middle));
  const second = strongestFrequency(waveform.slice(middle));
  const stable = Math.abs(first.hz - whole.hz) <= 0.16 &&
    Math.abs(second.hz - whole.hz) <= 0.16;
  const clear = whole.concentration >= 0.37 && Math.min(first.concentration, second.concentration) >= 0.30;
  if (!stable || !clear) return { waveform, bpm: null };
  const quality = Math.min(whole.concentration, first.concentration, second.concentration);
  return { waveform, bpm: Math.round(whole.hz * 60), quality };
}

function strongestFrequency(values) {
  // A Hann window reduces the effect of cutting the pulse at a partial beat.
  const center = mean(values);
  const windowed = values.map((value, i) =>
    (value - center) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (values.length - 1))));
  const spectrum = [];
  for (let bin = 0; bin <= 80; bin++) {
    const hz = (40 + bin * 1.75) / 60;
    let inPhase = 0;
    let outOfPhase = 0;
    for (let i = 0; i < windowed.length; i++) {
      const phase = 2 * Math.PI * hz * i / SAMPLE_RATE;
      inPhase += windowed[i] * Math.cos(phase);
      outOfPhase += windowed[i] * Math.sin(phase);
    }
    spectrum.push({ hz, power: inPhase ** 2 + outOfPhase ** 2 });
  }
  const strongest = spectrum.reduce((best, bin) => bin.power > best.power ? bin : best);
  const totalPower = spectrum.reduce((sum, bin) => sum + bin.power, 0);
  const peakPower = spectrum.reduce((sum, bin) =>
    Math.abs(bin.hz - strongest.hz) <= 0.16 ? sum + bin.power : sum, 0);
  return { hz: strongest.hz, concentration: totalPower > 0 ? peakPower / totalPower : 0 };
}
