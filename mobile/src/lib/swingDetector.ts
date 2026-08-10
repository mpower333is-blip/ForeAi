// Swing detector — turns a buffer of accelerometer samples into swing metrics.
//
// The phone's motion sensors capture a swing the same way Arccos-style sensors
// do: a still address, a takeaway, a transition at the top, then a sharp
// acceleration spike at impact, and a settled finish. This module is pure and
// synchronous so it can be unit-tested with synthetic signals; SwingScreen
// feeds it real samples collected from expo-sensors.

export type Sample = {
  t: number; // milliseconds since capture start
  mag: number; // dynamic acceleration magnitude in g (gravity removed)
};

export type SwingMetrics = {
  backswingMs: number;
  downswingMs: number;
  tempoRatio: number; // backswing : downswing
  peakG: number; // impact spike magnitude
  setupStability: number; // 0-100, higher = steadier address
  finishBalance: number; // 0-100, higher = better held finish
  totalMs: number;
};

export type DetectorOptions = {
  onsetThreshold?: number; // g above which motion counts as the takeaway
  minPeakG?: number; // reject noise: a real swing spikes at least this hard
  addressWindowMs?: number; // how much pre-takeaway stillness to score
  finishWindowMs?: number; // how much post-impact stillness to score
};

const DEFAULTS: Required<DetectorOptions> = {
  onsetThreshold: 0.12,
  minPeakG: 0.9,
  addressWindowMs: 400,
  finishWindowMs: 500,
};

// Turn a settled window's variability into a 0-100 steadiness score.
function stillnessScore(samples: Sample[]): number {
  if (samples.length === 0) return 0;
  const mean = samples.reduce((s, x) => s + x.mag, 0) / samples.length;
  const variance =
    samples.reduce((s, x) => s + (x.mag - mean) ** 2, 0) / samples.length;
  const rms = Math.sqrt(variance);
  // rms of ~0 → 100, rms of ~0.25g or more → 0.
  return Math.max(0, Math.min(100, Math.round(100 - (rms / 0.25) * 100)));
}

export function detectSwing(
  samples: Sample[],
  options: DetectorOptions = {}
): SwingMetrics | null {
  const opts = { ...DEFAULTS, ...options };
  if (samples.length < 8) return null;

  // Impact = the global peak. Reject if nothing spikes hard enough.
  let peakIdx = 0;
  for (let i = 1; i < samples.length; i++) {
    if (samples[i].mag > samples[peakIdx].mag) peakIdx = i;
  }
  const peak = samples[peakIdx];
  if (peak.mag < opts.minPeakG) return null;

  // Takeaway onset = first sustained motion before impact.
  let onsetIdx = -1;
  for (let i = 0; i < peakIdx; i++) {
    if (samples[i].mag >= opts.onsetThreshold) {
      onsetIdx = i;
      break;
    }
  }
  if (onsetIdx < 0 || onsetIdx >= peakIdx) return null;

  // Top of backswing = the quietest moment between takeaway and impact, where
  // the club changes direction and linear acceleration passes through a lull.
  let topIdx = onsetIdx;
  for (let i = onsetIdx; i < peakIdx; i++) {
    if (samples[i].mag < samples[topIdx].mag) topIdx = i;
  }
  // Guard against the top collapsing onto the onset when the lull is early.
  if (topIdx <= onsetIdx) topIdx = Math.floor((onsetIdx + peakIdx) / 2);

  const backswingMs = samples[topIdx].t - samples[onsetIdx].t;
  const downswingMs = samples[peakIdx].t - samples[topIdx].t;
  if (backswingMs <= 0 || downswingMs <= 0) return null;

  const tempoRatio = round1(backswingMs / downswingMs);

  const onsetT = samples[onsetIdx].t;
  const impactT = samples[peakIdx].t;
  const address = samples.filter(
    (s) => s.t >= onsetT - opts.addressWindowMs && s.t < onsetT
  );
  const finish = samples.filter(
    (s) => s.t > impactT + 150 && s.t <= impactT + 150 + opts.finishWindowMs
  );

  return {
    backswingMs,
    downswingMs,
    tempoRatio,
    peakG: round2(peak.mag),
    setupStability: stillnessScore(address),
    finishBalance: stillnessScore(finish),
    totalMs: samples[peakIdx].t - samples[onsetIdx].t,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
