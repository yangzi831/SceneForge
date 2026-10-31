import { describe, expect, it } from "vitest";
import { analyseAccents, createAudioReactor, sampleAccents } from "./audio-analysis.js";
function reactor(start: number, end: number) {
  const values = new Uint8Array(1024); values.fill(230, start, end);
  return createAudioReactor({ frequencyBinCount: 1024, fftSize: 2048, context: { sampleRate: 44100 }, getByteFrequencyData: (array: Uint8Array) => array.set(values) });
}
describe("musical accents", () => {
  it("responds to low drums and midrange accents independently", () => {
    const drum = reactor(2, 8).sample(), piano = reactor(20, 110).sample();
    expect(drum.kick).toBeGreaterThan(drum.piano); expect(piano.piano).toBeGreaterThan(piano.kick);
  });
  it("uses upper frequencies for fast bright transients", () => {
    expect(reactor(200, 600).sample().glitch).toBeGreaterThan(0.5);
  });
  it("does not keep triggering a held note at full strength", () => {
    const source = reactor(20, 110); source.sample(); let held = source.sample();
    for (let i = 0; i < 80; i++) held = source.sample();
    expect(held.piano).toBeLessThan(0.05);
  });
  it("retains a short accent between rendered frames and ignores distant seek history", () => {
    const samples = new Float32Array(1000); samples.fill(0.7, 500, 505);
    const track = analyseAccents({ sampleRate: 1000, getChannelData: () => samples });
    expect(sampleAccents(track, 0.55, 0.45)).toBeGreaterThan(0.5);
    expect(sampleAccents(track, 0.9, 0.1)).toBe(0);
  });
});
