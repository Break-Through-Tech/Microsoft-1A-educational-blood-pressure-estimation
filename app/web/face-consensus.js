
const MAX_RATE_GAP = 8;
const SINGLE_AREA_QUALITY = 0.59;

export function agreeOnPulse(candidates) {
  const sorted = candidates.filter(candidate => candidate.bpm !== null)
    .sort((a, b) => a.bpm - b.bpm);
  let best = [];
  let bestQuality = 0;
  for (let i = 0; i < sorted.length; i++) {
    const nearby = sorted.slice(i).filter(candidate => candidate.bpm - sorted[i].bpm <= MAX_RATE_GAP);
    const quality = nearby.reduce((sum, candidate) => sum + candidate.quality, 0);
    if (nearby.length > best.length || (nearby.length === best.length && quality > bestQuality)) {
      best = nearby;
      bestQuality = quality;
    }
  }
  if (!best.length) return null;
  if (best.length === 1 && (sorted.length > 1 || bestQuality < SINGLE_AREA_QUALITY)) return null;

  const clearest = best.reduce((highest, candidate) => candidate.quality > highest.quality ? candidate : highest);
  const weightedRate = best.reduce((sum, candidate) => sum + candidate.bpm * candidate.quality, 0);
  return {
    waveform: clearest.waveform,
    bpm: Math.round(weightedRate / bestQuality),
    score: bestQuality / best.length + 0.18 * (best.length - 1),
  };
}
