import * as THREE from "three";

// Both canvases share one clock and vanishing point. The sparse foreground
// layer is keyed against black by the stage's existing scrim shader.
export function createShowVisual() {
  const W = 1536, H = 768, TAU = Math.PI * 2;
  const makeCanvas = () => {
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    return { ctx: canvas.getContext("2d"), texture };
  };
  const back = makeCanvas(), front = makeCanvas();
  const rand = (n) => { const x = Math.sin(n * 127.1 + 19.19) * 43758.5453; return x - Math.floor(x); };
  const line = (ctx, x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  function polygon(ctx, x, y, radius, sides, rotation, flatten = 0.68) {
    ctx.beginPath();
    for (let i = 0; i <= sides; i++) {
      const a = rotation + TAU * i / sides;
      const px = x + Math.cos(a) * radius, py = y + Math.sin(a) * radius * flatten;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  function layer(ctx, weight, draw) {
    if (weight <= 0) return;
    ctx.save(); ctx.globalAlpha = weight; draw(); ctx.restore();
  }
  function render(t, flashIntensity = 0.55) {
    // A 32-second cycle; every motion phase returns to its starting point.
    t = ((t % 32) + 32) % 32;
    const phase = TAU * t / 32;
    const segment = Math.floor(t / 8), segmentTime = t % 8;
    const fade = Math.max(0, Math.min(1, (segmentTime - 6.6) / 1.4));
    const smooth = fade * fade * (3 - 2 * fade);
    const weights = [0, 0, 0, 0];
    weights[segment] = 1 - smooth; weights[(segment + 1) % 4] = smooth;
    const cx = W * (0.5 + 0.045 * Math.sin(phase * 2));
    const cy = H * (0.50 + 0.035 * Math.cos(phase * 3));
    const flash = ((t * 5) % 1 < 0.14 ? 1 : 0) * flashIntensity;
    const ctx = back.ctx, fg = front.ctx;
    for (const c of [ctx, fg]) { c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.fillStyle = "#000"; c.fillRect(0, 0, W, H); }

    // The underlying perspective field ties the four movements together.
    ctx.save(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1;
    for (let i = 0; i < 32; i++) {
      const a = TAU * i / 32 + phase * 0.5;
      ctx.globalAlpha = 0.07 + flash * 0.09;
      line(ctx, cx, cy, cx + Math.cos(a) * W, cy + Math.sin(a) * H);
    }
    ctx.restore();
    layer(ctx, weights[0], () => {
      // Converging streams of particles, with a few short luminous trails.
      for (let i = 0; i < 260; i++) {
        const z = (rand(i + 11) + t / 8) % 1;
        const a = rand(i + 100) * TAU + phase * (i % 2 ? 2 : -2);
        const radius = (0.02 + z * z * 0.72) * W;
        const x = cx + Math.cos(a) * radius, y = cy + Math.sin(a) * radius * 0.53;
        const size = 0.8 + z * z * 4;
        ctx.fillStyle = `rgba(255,255,255,${0.25 + z * 0.75})`;
        ctx.fillRect(x, y, size * (i % 9 === 0 ? 3 : 1), size);
      }
      ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) polygon(ctx, cx, cy, 85 + i * 28, 3, -Math.PI / 2 + phase * 2 + i * 0.1);
    });
    layer(ctx, weights[1], () => {
      // Polygon frames rush through a shared vanishing point.
      ctx.strokeStyle = "#fff";
      for (let i = 0; i < 14; i++) {
        const z = (i / 14 + t / (32 / 6)) % 1;
        ctx.globalAlpha = weights[1] * (0.15 + z * 0.8);
        ctx.lineWidth = 1 + z * 4;
        polygon(ctx, cx, cy, 25 + z * z * 1050, i % 3 === 0 ? 3 : 6, -Math.PI / 2 + phase * 2 + i * 0.10);
      }
    });
    layer(ctx, weights[2], () => {
      // Sharp moving planes break the tunnel into rhythmic screen-sized slices.
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(phase * 2);
      for (let i = 0; i < 12; i++) {
        const a = TAU * i / 12;
        ctx.save(); ctx.rotate(a); ctx.fillStyle = `rgba(255,255,255,${i % 3 === 0 ? 0.75 : 0.22})`;
        ctx.beginPath(); ctx.moveTo(65, -2); ctx.lineTo(1100, -8 - (i % 3) * 12); ctx.lineTo(1100, 8 + (i % 3) * 12); ctx.closePath(); ctx.fill(); ctx.restore();
      }
      ctx.restore();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) polygon(ctx, cx, cy, 80 + i * 105, 3, -Math.PI / 2 - phase * 2, 0.7);
      for (let i = 0; i < 22; i++) {
        const y = ((i / 22 + t / 8) % 1) * H;
        ctx.fillStyle = `rgba(255,255,255,${i % 4 === 0 ? 0.6 : 0.18})`;
        ctx.fillRect(0, y, W, i % 4 === 0 ? 4 : 1);
      }
    });
    layer(ctx, weights[3], () => {
      // A rotating orbital constellation echoes the physical suspended sphere.
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(phase * 2);
      for (let j = 0; j < 9; j++) {
        ctx.save(); ctx.rotate(j * Math.PI / 9); ctx.scale(1, 0.28 + 0.05 * Math.sin(phase * 2));
        ctx.strokeStyle = `rgba(255,255,255,${0.22 + j * 0.055})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 245 + j * 13, 0, TAU); ctx.stroke(); ctx.restore();
      }
      ctx.restore();
      for (let i = 0; i < 200; i++) {
        const a = rand(i + 900) * TAU + phase * (i % 2 ? 3 : -3);
        const radius = 50 + rand(i + 700) * W * 0.48;
        const x = cx + Math.cos(a) * radius, y = cy + Math.sin(a) * radius * 0.52;
        const size = 1 + rand(i + 33) * 4;
        ctx.fillStyle = `rgba(255,255,255,${0.25 + rand(i + 73) * 0.7})`; ctx.fillRect(x, y, size, size);
      }
    });
    if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash * 0.32})`; ctx.fillRect(0, 0, W, H); }

    // Near-camera outlines and particles move faster and larger than the back
    // layer, creating parallax while leaving the black scrim transparent.
    fg.strokeStyle = "#fff";
    for (let i = 0; i < 5; i++) {
      const z = (i / 5 + t / 8) % 1;
      fg.globalAlpha = 0.22 + z * 0.65;
      fg.lineWidth = 1.5 + z * 3 + flash * 3;
      polygon(fg, cx + Math.sin(phase * 2) * 70 * z, cy, 95 + z * z * 1000, segment === 3 ? 6 : 3, -Math.PI / 2 - phase * 2, 0.68);
    }
    fg.globalAlpha = 1;
    for (let i = 0; i < 70; i++) {
      const z = (rand(i + 2000) + t / 4) % 1;
      const a = rand(i + 2500) * TAU - phase * 3;
      const r = 120 + z * z * 1000;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.55;
      const s = 1.5 + z * 4;
      fg.fillStyle = `rgba(255,255,255,${0.35 + z * 0.6})`;
      fg.fillRect(x, y, s * (i % 5 === 0 ? 4 : 1), s);
    }
    if (flash > 0) {
      fg.strokeStyle = `rgba(255,255,255,${flash * 0.8})`; fg.lineWidth = 5;
      for (let i = 0; i < 7; i++) line(fg, 0, H * (i + 1) / 8, W, H * (i + 1) / 8);
    }
    back.texture.needsUpdate = true; front.texture.needsUpdate = true;
  }
  return { texture: back.texture, foregroundTexture: front.texture, render, dispose() { back.texture.dispose(); front.texture.dispose(); } };
}
