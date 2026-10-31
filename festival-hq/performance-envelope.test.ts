import { describe, expect, it } from "vitest";
import { performanceEnvelope } from "./performance-envelope";
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
