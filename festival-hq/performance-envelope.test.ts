import { describe, expect, it } from "vitest";
import { performanceEnvelope, musicalArc } from "./performance-envelope";
const audio = { bpm: 89, beatOffset: 0, dropTime: null, energy: 0.7, impact: 0 };
describe("performance rhythm", () => {
  it("subdivides the beat into a fast pulse train", () => {
    let edges = 0, previous = false;
    for (let i = 0; i < 1000; i++) { const on = performanceEnvelope(i / 1000, 0.65, audio).flash > 0; if (on && !previous) edges++; previous = on; }
    expect(edges).toBeGreaterThanOrEqual(11); expect(edges).toBeLessThanOrEqual(13);
  });
  it("responds to kick, piano and micro accents between beats", () => {
    expect(performanceEnvelope(0.1, 0.65, { ...audio, kick: 1 }).burst).toBe(1);
    expect(performanceEnvelope(0.1, 0.65, { ...audio, piano: 1 }).burst).toBeGreaterThan(0.9);
    expect(performanceEnvelope(0.1, 0.65, { ...audio, microAccent: 0.9 }).glitch).toBe(0.9);
  });
  it("lets flash intensity reach zero without stopping geometric accents", () => {
    const pulse = performanceEnvelope(0, 0, { ...audio, kick: 1, glitch: 1 });
    expect(pulse.flash).toBe(0); expect(pulse.burst).toBe(1);
  });
});

describe("musical build after the drop", () => {
  const track = { ...audio, dropTime: 44.43, kick: 0.6, piano: 0.6, microAccent: 0.5 };
  it("sustains extra intensity long after the initial impact", () => {
    const before = performanceEnvelope(30, 0.65, track), after = performanceEnvelope(55, 0.65, track), finale = performanceEnvelope(75, 0.65, track);
    expect(after.lift).toBeGreaterThan(0.7);
    expect(after.hz).toBeGreaterThan(before.hz);
    expect(after.hitGain).toBeGreaterThan(before.hitGain);
    expect(after.lineGain).toBeGreaterThan(before.lineGain);
    expect(finale.lift).toBeGreaterThan(after.lift);
    expect(after.cutDepth).toBeLessThan(0.75);
  });
  it("accelerates continuously rather than jumping animation phase", () => {
    const a = musicalArc(44.429, 44.43), b = musicalArc(44.431, 44.43);
    expect(Math.abs(b.motion - a.motion)).toBeLessThan(0.01);
    const earlySpeed = musicalArc(20.1, 44.43).motion - musicalArc(20, 44.43).motion;
    const lateSpeed = musicalArc(75.1, 44.43).motion - musicalArc(75, 44.43).motion;
    expect(lateSpeed).toBeGreaterThan(earlySpeed * 1.5);
  });
  it("keeps a new loop and tracks without a detected drop at the base level", () => {
    expect(musicalArc(0, 44.43).lift).toBe(0);
    expect(musicalArc(80, null).lift).toBe(0);
  });
});
