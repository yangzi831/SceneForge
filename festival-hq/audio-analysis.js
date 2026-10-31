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
  const previous = new Float32Array(spectrum.length);
  let averageFlux = 0.03, envelope = 0, impact = 0;
  return {
    sample() {
      analyser.getByteFrequencyData(spectrum);
      let flux = 0, bass = 0, level = 0;
      for (let i = 1; i < spectrum.length; i++) {
        const v = spectrum[i] / 255;
        if (i < 180) flux += Math.max(0, v - previous[i]);
        if (i < 12) bass += v;
        if (i < 180) level += v;
        previous[i] = v;
      }
      flux /= Math.min(179, spectrum.length - 1); bass /= 11; level /= Math.min(179, spectrum.length - 1);
      const excess = Math.max(0, (flux - averageFlux * 1.25) * 12);
      averageFlux = averageFlux * 0.94 + flux * 0.06;
      impact = Math.max(excess, impact * 0.72);
      envelope += (level - envelope) * 0.22;
      return { energy: Math.min(1, envelope * 2), bass, impact: Math.min(1, impact), bands: Array.from({ length: 64 }, (_, i) => spectrum[Math.min(spectrum.length - 1, 1 + Math.floor(Math.pow(i / 64, 1.8) * 250))] / 255) };
    },
  };
}
