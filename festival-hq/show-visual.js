import * as THREE from "three";
import { drawVisualStyle } from "./visual-styles.js";
import { performanceEnvelope } from "./performance-envelope.ts";

// One master canvas is sampled by every screen. Impacts and flashes are drawn
// once here and sent as shared shader uniforms for exact cross-screen timing.
export function createShowVisual() {
  const W = 1536, H = 768, TAU = Math.PI * 2;
  const canvas = document.createElement("canvas"), scratch = document.createElement("canvas");
  canvas.width = scratch.width = W; canvas.height = scratch.height = H;
  const ctx = canvas.getContext("2d"), copy = scratch.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.minFilter = THREE.LinearFilter;
  const rand = (n) => { const x = Math.sin(n * 127.1 + 19.19) * 43758.5453; return x - Math.floor(x); };
  let kickTime = -10, pianoTime = -10, previousTime = -1, lastKick = 0, lastPiano = 0;
  function polygon(x, y, radius, sides, rotation) {
    ctx.beginPath();
    for (let i = 0; i <= sides; i++) { const a = rotation + TAU * i / sides; const px = x + Math.cos(a) * radius, py = y + Math.sin(a) * radius * 0.65; if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
    ctx.stroke();
  }
  function render(time, intensity = 0.85, audio = null, style = "a", density = 2.2) {
    const pulse = performanceEnvelope(time, intensity, audio);
    if (time < previousTime) { kickTime = -10; pianoTime = -10; lastKick = 0; lastPiano = 0; }
    if (pulse.kick > 0.48 && (lastKick < 0.38 || pulse.kick - lastKick > 0.2) && time - kickTime > 0.08) kickTime = time;
    if (pulse.piano > 0.48 && (lastPiano < 0.38 || pulse.piano - lastPiano > 0.2) && time - pianoTime > 0.075) pianoTime = time;
    lastKick = pulse.kick; lastPiano = pulse.piano;
    previousTime = time;
    for (const c of [ctx, copy]) { c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.fillStyle = "#000"; c.fillRect(0, 0, W, H); }
    const motion = time * 1.6;
    drawVisualStyle(ctx, copy, style === "auto" ? "a" : style, motion, audio, 1.7);
    // Keep the primary silhouette readable; sparse accents supply motion
    // without laying a second line lattice across every visual preset.
    const count = Math.floor(38 * density);
    ctx.strokeStyle = "#fff";
    for (let i = 0; i < count; i++) {
      const x = (rand(i + 53) * W + motion * (40 + rand(i) * 100)) % W;
      const y = rand(i + 97) * H, len = 2 + rand(i + 88) * (12 + pulse.energy * 38);
      ctx.globalAlpha = 0.09 + rand(i + 2) * (0.12 + pulse.energy * 0.16); ctx.lineWidth = i % 7 === 0 ? 2.4 : 1.6;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.stroke();
      if (i % 5 === 0) { ctx.fillStyle = "#fff"; ctx.fillRect(x, y + 7, 2, 2); }
    }
    ctx.globalAlpha = 1;
    const kickAge = time - kickTime, pianoAge = time - pianoTime;
    const kickShock = Math.exp(-Math.max(0, kickAge) * 8), pianoShock = Math.exp(-Math.max(0, pianoAge) * 11);
    if (kickShock > 0.03 || pulse.drop > 0) {
      const force = Math.max(kickShock, pulse.drop); ctx.strokeStyle = `rgba(255,255,255,${force})`; ctx.lineWidth = 2 + force * 4;
      for (let i = 0; i < 5; i++) polygon(W / 2, H / 2, 35 + kickAge * 1900 + i * 48, i % 2 ? 4 : 6, time * 0.15);
      for (let i = 0; i < 28; i++) { const a = i * TAU / 28; ctx.globalAlpha = force * (i % 4 ? 0.35 : 0.8); ctx.beginPath(); ctx.moveTo(W / 2 + Math.cos(a) * 45, H / 2 + Math.sin(a) * 30); ctx.lineTo(W / 2 + Math.cos(a) * W, H / 2 + Math.sin(a) * H); ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
    if (pianoShock > 0.03) {
      const tick = Math.floor(pianoTime * 30);
      for (let i = 0; i < 10; i++) {
        const x = rand(i + tick) * W, y = rand(i * 9 + tick) * H, width = 20 + rand(i * 3 + tick) * 160;
        ctx.fillStyle = `rgba(255,255,255,${pianoShock * (i % 3 ? 0.15 : 0.65)})`;
        ctx.fillRect(x, y, width, 6 + rand(i + 3) * 60);
        ctx.strokeStyle = `rgba(255,255,255,${pianoShock})`; ctx.lineWidth = 2; ctx.strokeRect(x, y, width * 1.3, 35 + rand(i + 4) * 80);
      }
    }
    const tear = Math.min(1, Math.max(0, pulse.glitch - 0.22) * 1.35 + pulse.drop * 0.3);
    if (tear > 0.14) {
      copy.globalAlpha = 1; copy.drawImage(canvas, 0, 0);
      const tick = Math.floor(time * 28);
      for (let i = 0; i < 12 + Math.floor(tear * 30); i++) {
        const y = Math.floor(rand(i * 93 + tick) * H), height = 2 + Math.floor(rand(i + 7) * (10 + tear * 24));
        const shift = (rand(i * 71 + tick) - 0.5) * (70 + tear * 450);
        ctx.drawImage(scratch, 0, y, W, height, shift, y, W, height);
        if (i % 4 === 0) { ctx.fillStyle = `rgba(255,255,255,${tear * 0.9})`; ctx.fillRect(0, y, W * rand(i + 77), 2); }
      }
      ctx.save(); ctx.globalCompositeOperation = "difference"; ctx.fillStyle = `rgba(255,255,255,${tear * 0.45})`;
      for (let i = 0; i < 5; i++) ctx.fillRect(rand(i + tick) * W, rand(i * 4 + tick) * H, W * 0.16, 8 + tear * 45);
      ctx.restore();
    }
    if (pulse.hush) { ctx.fillStyle = `rgba(0,0,0,${pulse.hush})`; ctx.fillRect(0, 0, W, H); }
    // Fast contrast cuts retain the pattern; never wash the whole canvas white.
    const cut = Math.max(0, intensity) * (1 - pulse.flash) * 0.46;
    if (cut > 0) { ctx.fillStyle = `rgba(0,0,0,${cut})`; ctx.fillRect(0, 0, W, H); }
    if (pulse.glitch > 0.4 && pulse.flash > 0.4) {
      ctx.fillStyle = `rgba(255,255,255,${pulse.glitch * 0.3})`;
      for (let i = 0; i < 5; i++) ctx.fillRect(0, rand(i + Math.floor(time * 24)) * H, W, 1.5);
    }
    texture.needsUpdate = true;
    return { ...pulse, kickShock, pianoShock };
  }
  return { texture, foregroundTexture: texture, render, dispose() { texture.dispose(); } };
}
