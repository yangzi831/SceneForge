// Estimate a beat grid from short-time energy changes. The analyser below adds
// real-time spectral transients, so accents need not fall on this grid.
export function analyseTrack(buffer) {
  const sampleRate = buffer.sampleRate;
  const samples = buffer.getChannelData(0);
  const hop = Math.max(1, Math.round(sampleRate * 0.025));
  const energy = [];
  for (let i = 0; i < samples.length; i += hop) {
    let sum = 0; const end = Math.min(i + hop, samples.length);
    for (let j = i; j < end; j++) sum += samples[j] * samples[j];
    energy.push(Math.sqrt(sum / (end - i)));
  }
  const onset = energy.map((v, i) => Math.max(0, v - (energy[i - 1] || 0)));
  let bestLag = 20, bestScore = -1;
  for (let lag = 13; lag <= 34; lag++) {
    let score = 0;
    for (let i = lag; i < onset.length; i++) score += onset[i] * onset[i - lag];
    if (score > bestScore) { bestScore = score; bestLag = lag; }
  }
  let bestPhase = 0, phaseScore = -1;
  for (let phase = 0; phase < bestLag; phase++) {
    let score = 0;
    for (let i = phase; i < onset.length; i += bestLag) score += onset[i];
    if (score > phaseScore) { phaseScore = score; bestPhase = phase; }
  }
  // Find an extended energy jump after a quieter passage, not an individual kick.
  let dropIndex = 0, dropScore = 0;
  for (let i = 100; i < energy.length - 100; i += 2) {
    let before = 0, after = 0;
    for (let j = 1; j <= 60; j++) { before += energy[i - j]; after += energy[i + j]; }
    before /= 60; after /= 60;
    const score = (after - before) * Math.min(1, after / 0.2);
    if (score > dropScore) { dropScore = score; dropIndex = i; }
  }
  return { bpm: 60 / (bestLag * hop / sampleRate), beatOffset: bestPhase * hop / sampleRate, dropTime: dropScore > 0.04 ? dropIndex * hop / sampleRate : null };
}

export function createAudioReactor(analyser) {
  const spectrum = new Uint8Array(analyser.frequencyBinCount);
  const ranges = [[35, 180], [220, 4200], [3500, 14000]];
  const history = [0, 0, 0], floors = [0.05, 0.05, 0.05], envelopes = [0, 0, 0];
  const previous = new Float32Array(spectrum.length);
  let fluxFloor = 0.015, broadImpact = 0, envelope = 0;
  return {
    sample() {
      analyser.getByteFrequencyData(spectrum);
      const binHz = (analyser.context?.sampleRate || 44100) / analyser.fftSize;
      const levels = ranges.map(([lo, hi]) => {
        const start = Math.max(1, Math.floor(lo / binHz)), end = Math.min(spectrum.length, Math.ceil(hi / binHz));
        let sum = 0; for (let i = start; i < end; i++) sum += (spectrum[i] / 255) ** 2;
        return Math.sqrt(sum / Math.max(1, end - start));
      });
      let flux = 0;
      for (let i = 1; i < spectrum.length; i++) { const value = spectrum[i] / 255; flux += Math.max(0, value - previous[i]); previous[i] = value; }
      flux /= spectrum.length;
      const attacks = levels.map((level, i) => {
        const delta = Math.max(0, level - history[i]);
        const transient = Math.max(0, level - floors[i] * 1.10);
        const attack = Math.min(1, (delta * 3.2 + transient * 1.8) / (0.18 + floors[i]));
        envelopes[i] = Math.max(attack, envelopes[i] * 0.68);
        history[i] = level; floors[i] += (level - floors[i]) * 0.1;
        return envelopes[i];
      });
      broadImpact = Math.max(Math.max(0, flux - fluxFloor * 1.08) * 28, broadImpact * 0.55);
      fluxFloor += (flux - fluxFloor) * 0.07;
      const level = (levels[0] + levels[1] + levels[2]) / 3;
      envelope += (level - envelope) * 0.35;
      return {
        energy: Math.min(1, envelope * 1.9), bass: levels[0],
        kick: attacks[0], piano: attacks[1], glitch: Math.max(attacks[2], Math.min(1, broadImpact)),
        impact: Math.min(1, Math.max(...attacks, broadImpact)),
        bands: Array.from({ length: 64 }, (_, i) => spectrum[Math.min(spectrum.length - 1, 1 + Math.floor((i / 64) ** 1.8 * spectrum.length * 0.65))] / 255),
      };
    },
  };
}

// A short-time full-track envelope retains 5 ms accents that can fall between
// rendered frames. It complements live frequency analysis rather than a BPM grid.
export function analyseAccents(buffer) {
  const samples = buffer.getChannelData(0), hop = Math.max(1, Math.round(buffer.sampleRate * 0.005));
  const count = Math.ceil(samples.length / hop);
  const energy = new Float32Array(count), brightness = new Float32Array(count), peaks = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    let sum = 0, diff = 0; const start = i * hop, end = Math.min(start + hop, samples.length);
    for (let j = start; j < end; j++) { sum += samples[j] ** 2; diff += (samples[j] - (samples[j - 1] || 0)) ** 2; }
    energy[i] = Math.sqrt(sum / (end - start)); brightness[i] = Math.sqrt(diff / (end - start));
  }
  let average = energy[0] || 0.01, highAverage = brightness[0] || 0.01;
  for (let i = 0; i < count; i++) {
    const rise = Math.max(0, energy[i] - average * 1.03) / (average + 0.015);
    const highRise = Math.max(0, brightness[i] - highAverage * 1.04) / (highAverage + 0.008);
    peaks[i] = Math.min(1, (rise * 0.55 + highRise * 0.9) * Math.min(1, energy[i] * 14));
    average += (energy[i] - average) * 0.055; highAverage += (brightness[i] - highAverage) * 0.055;
  }
  return { peaks, step: hop / buffer.sampleRate };
}
export function sampleAccents(track, time, previousTime) {
  if (!track) return 0;
  const startTime = previousTime >= 0 && time >= previousTime && time - previousTime < 0.15 ? previousTime : time - 0.018;
  const start = Math.max(0, Math.floor(startTime / track.step)), end = Math.min(track.peaks.length - 1, Math.ceil(time / track.step));
  let peak = 0; for (let i = start; i <= end; i++) peak = Math.max(peak, track.peaks[i]);
  return peak;
}
