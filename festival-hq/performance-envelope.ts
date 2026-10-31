export interface AudioPulse {
  bpm: number; beatOffset: number; dropTime: number | null; energy: number;
  impact: number; kick?: number; piano?: number; glitch?: number; microAccent?: number;
}
export function performanceEnvelope(time: number, intensity: number, audio: AudioPulse | null) {
  const bpm = audio?.bpm || 120;
  // Eighth-beat subdivisions yield about 12 Hz for Nemesis's detected 89 BPM.
  const hz = Math.min(18, Math.max(8, bpm / 60 * 8));
  const phase = (((time - (audio?.beatOffset || 0)) * hz) % 1 + 1) % 1;
  const energy = audio?.energy ?? 0.65;
  const glitch = Math.min(1, Math.max(audio?.glitch || 0, audio?.microAccent || 0));
  const kick = audio?.kick || 0, piano = audio?.piano || 0;
  const drop = audio?.dropTime == null ? 0 : Math.max(0, 1 - Math.abs(time - audio.dropTime) / 0.8);
  const hush = audio?.dropTime != null && time > audio.dropTime - 1.6 && time < audio.dropTime - 0.08 ? 0.72 : 0;
  const microGate = ((time * hz * 1.5) % 1) < 0.48 ? 1 : 0;
  const flash = Math.min(1, ((phase < 0.38 ? 0.55 + energy * 0.45 : 0) + microGate * glitch * 0.55 + drop * 0.45) * Math.max(0, intensity)) * (1 - hush);
  return { flash, glitch, kick, piano, drop, hush, energy, hz, burst: Math.min(1, Math.max(kick, piano * 0.95, glitch * 0.8, drop)) };
}
