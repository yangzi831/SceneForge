export interface AudioPulse {
  bpm: number; beatOffset: number; dropTime: number | null; energy: number;
  impact: number; kick?: number; piano?: number; glitch?: number; microAccent?: number;
}

/** A sustained musical arc, separate from individual transient peaks. */
export function musicalArc(time: number, dropTime: number | null) {
  const sinceDrop = dropTime == null ? 0 : Math.max(0, time - dropTime);
  const finaleTime = Math.max(0, sinceDrop - 18);
  const lift = (1 - Math.exp(-sinceDrop / 2.2)) * 0.72 + (1 - Math.exp(-finaleTime / 3)) * 0.28;
  // Integrating the extra speed keeps movement continuous at both transitions.
  const extraMotion = 0.9 * (sinceDrop - 2.2 * (1 - Math.exp(-sinceDrop / 2.2)))
    + 0.35 * (finaleTime - 3 * (1 - Math.exp(-finaleTime / 3)));
  return { lift, motion: time * 1.85 + extraMotion };
}

export function performanceEnvelope(time: number, intensity: number, audio: AudioPulse | null) {
  const bpm = audio?.bpm || 120;
  const arc = musicalArc(time, audio?.dropTime ?? null);
  // Later passages add faster subdivisions, retaining the same beat clock.
  const subdivisions = arc.lift > 0.5 ? 12 : 8;
  const hz = Math.min(18, Math.max(8, bpm / 60 * subdivisions));
  const beat = (time - (audio?.beatOffset || 0)) * bpm / 60;
  const phase = (((time - (audio?.beatOffset || 0)) * hz) % 1 + 1) % 1;
  const energy = audio?.energy ?? 0.65;
  const glitch = Math.min(1, Math.max(audio?.glitch || 0, audio?.microAccent || 0) * (1 + arc.lift * 0.35));
  const kick = audio?.kick || 0, piano = audio?.piano || 0;
  const drop = audio?.dropTime == null ? 0 : Math.max(0, 1 - Math.abs(time - audio.dropTime) / 0.8);
  const hush = audio?.dropTime != null && time > audio.dropTime - 1.6 && time < audio.dropTime - 0.08 ? 0.72 : 0;
  const microGate = ((time * hz * 1.5) % 1) < 0.48 ? 1 : 0;
  const flash = Math.min(1, ((phase < 0.38 ? 0.55 + energy * 0.45 : 0) + microGate * glitch * 0.55 + drop * 0.45) * Math.max(0, intensity)) * (1 - hush);
  return {
    ...arc, flash, glitch, kick, piano, drop, hush, energy, hz, beat,
    lineGain: 0.13 + arc.lift * 0.15,
    hitGain: 1.15 + arc.lift * 0.6,
    cutDepth: 0.48 + arc.lift * 0.24,
    burst: Math.min(1, Math.max(kick, piano * 0.95, glitch * 0.8, drop) * (1.1 + arc.lift * 0.35)),
  };
}
