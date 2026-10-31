import { describe, expect, it } from "vitest";
import { createShowDirector } from "./show-director";
const input = { time: 0, bpm: 120, beatOffset: 0, beatsPerCue: 4, impact: 0, energy: 0.5 };
describe("automatic show director", () => {
  it("changes colors faster than visuals while keeping both below the strobe rate", () => {
    const director = createShowDirector(["a", "b", "c", "d"], 6);
    const first = { ...director.update(input) };
    const nextColor = { ...director.update({ ...input, time: 1 }) };
    expect(nextColor.style).toBe(first.style);
    expect(nextColor.paletteIndex).not.toBe(first.paletteIndex);
    expect(director.update({ ...input, time: 2 }).style).not.toBe(first.style);
  });
  it("responds to transients without switching on every frame", () => {
    const director = createShowDirector(["a", "b", "c", "d"], 6);
    const first = { ...director.update(input) };
    const accent = { ...director.update({ ...input, time: 1.2, impact: 0.9 }) };
    expect(accent.style).not.toBe(first.style);
    expect(director.update({ ...input, time: 1.23, impact: 0.9 }).style).toBe(accent.style);
  });
  it("seeking backwards restores the cue for the new position", () => {
    const director = createShowDirector(["a", "b", "c", "d"], 6);
    director.update({ ...input, time: 15 });
    expect(director.update(input)).toEqual({ style: "a", paletteIndex: 0 });
  });
});
