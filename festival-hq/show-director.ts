export interface DirectorInput {
  time: number;
  bpm: number;
  beatOffset: number;
  beatsPerCue: number;
  impact: number;
  energy: number;
}
export interface DirectorCue { style: string; paletteIndex: number; }

/** Beat subdivisions drive flashes elsewhere; this slower clock changes scenes. */
export function createShowDirector(styles: readonly string[], paletteCount: number) {
  if (styles.length === 0 || paletteCount < 1) throw new Error("Director needs visual and palette choices");
  let previousTime = -1, lastCell = -1, lastSwitch = -Infinity, accent = 0;
  let cue: DirectorCue = { style: styles[0], paletteIndex: 0 };
  return {
    update(input: DirectorInput): DirectorCue {
      const { time, beatOffset, impact, energy } = input;
      const bpm = Number.isFinite(input.bpm) ? Math.max(60, Math.min(200, input.bpm)) : 120;
      const beats = Math.max(2, input.beatsPerCue);
      const beat = Math.max(0, (time - beatOffset) * bpm / 60);
      const cell = Math.floor(beat / beats);
      if (time < previousTime || previousTime < 0) { lastCell = -1; lastSwitch = -Infinity; accent = 0; }
      const transient = impact > 0.55 && energy > 0.2 && time - lastSwitch >= 1.0;
      if (cell !== lastCell || transient) {
        if (transient && cell === lastCell) accent++;
        cue = { style: styles[((cell + accent) * 7) % styles.length], paletteIndex: cue.paletteIndex };
        lastCell = cell; lastSwitch = time;
      }
      cue.paletteIndex = Math.floor(beat / Math.max(1, beats / 2)) % paletteCount;
      previousTime = time;
      return cue;
    },
  };
}
