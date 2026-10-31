// Original monochrome visual instruments for live stage use.
export const VISUAL_STYLES = [
  ["a", "流体波纹"], ["b", "粒子星河"], ["c", "故障切片"],
  ["d", "脉冲圆环"], ["e", "穿梭隧道"], ["f", "数字地形"],
  ["g", "垂直光雨"], ["h", "几何碎片"], ["i", "音频频谱"],
  ["j", "扫描光栅"], ["k", "原子轨迹"], ["l", "等高线场"],
  ["m", "数字雪花"], ["n", "网格脉冲"], ["o", "电弧闪链"],
  ["p", "反向光束"], ["q", "星云漩涡"], ["r", "破碎镜面"],
  ["s", "双螺旋"], ["t", "声波轨迹"], ["u", "点阵呼吸"],
  ["v", "流光幕帘"], ["w", "交错斜线"], ["x", "X 射线"],
  ["y", "光斑回声"], ["z", "能量爆发"],
];

export function drawVisualStyle(ctx, fg, style, time, audio, lineWeight = 1) {
  const w = ctx.canvas.width, h = ctx.canvas.height, pi = Math.PI, tau = pi * 2;
  const rand = (n) => { const x = Math.sin(n * 127.1 + 13.37) * 43758.5453; return x - Math.floor(x); };
  const energy = audio ? audio.energy : 0.45, bass = audio ? audio.bass : 0.4, hit = audio ? audio.impact : 0;
  const pulse = 1 + bass * 0.16 + hit * 0.12;
  const stroke = (c, alpha = 1, width = 1) => { c.strokeStyle = `rgba(255,255,255,${alpha})`; c.lineWidth = Math.max(1.3, width * lineWeight); };
  const line = (c, x, y, x2, y2) => { c.beginPath(); c.moveTo(x,y); c.lineTo(x2,y2); c.stroke(); };
  const poly = (c, x, y, r, sides, a = 0, aspect = 0.65) => {
    c.beginPath(); for (let i = 0; i <= sides; i++) { const q = a + i*tau/sides; const px=x+Math.cos(q)*r, py=y+Math.sin(q)*r*aspect; if (!i) c.moveTo(px,py); else c.lineTo(px,py); } c.stroke();
  };
  ctx.save(); fg.save();
  if (style === "a" || style === "l") {
    // Bands and terrain-like contour lines travel independently in depth.
    const count = style === "a" ? 34 : 44;
    for (let j = 0; j < count; j++) {
      stroke(ctx, 0.12 + (j % 5 === 0 ? 0.65 : 0.24), j % 5 === 0 ? 2.5 : 1);
      ctx.beginPath();
      for (let i = 0; i <= 100; i++) {
        const x = i*w/100, u=i/100, row=(j/(count-1)-0.5)*h*1.25;
        const wave = style === "a"
          ? Math.sin(u*11 + time*1.5 + j*0.17)*55 + Math.sin(u*22-time*1.0+j*0.08)*16
          : Math.sin(u*7 + j*0.15 + time*0.45)*Math.exp(-Math.pow((u-0.5)*2,2))*130 + Math.sin(u*18+j*.18-time)*18;
        const y=h*.5+row+wave*pulse; if (!i) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }
      ctx.stroke();
    }
    for(let j=0;j<6;j++){ stroke(fg,.28+j*.08,2); fg.beginPath(); for(let i=0;i<=80;i++){const x=i*w/80,y=h*(.24+j*.11)+Math.sin(i*.10+time*1.7+j*.7)*75*pulse; if(!i)fg.moveTo(x,y);else fg.lineTo(x,y);}fg.stroke(); }
  } else if (style === "b") {
    for(let i=0;i<950;i++) {
      const z=(rand(i+90)+time*.12)%1, angle=rand(i+21)*tau+time*.16;
      const radius=(.015+z*z*.77)*w, x=w/2+Math.cos(angle)*radius, y=h/2+Math.sin(angle)*radius*.52;
      const size=0.8+z*z*3.8; ctx.fillStyle=`rgba(255,255,255,${.2+z*.8})`;ctx.fillRect(x,y,size,size);
    }
    for(let i=0;i<50;i++){const z=(rand(i+710)+time*.22)%1,a=rand(i+530)*tau-time*.2,r=(.1+z*z*.85)*w;fg.fillStyle=`rgba(255,255,255,${.3+z*.6})`;fg.fillRect(w/2+Math.cos(a)*r,h/2+Math.sin(a)*r*.52,3+z*6,2+z*3);}
  } else if (style === "c") {
    const tick=Math.floor(time*(9+hit*9));
    for(let i=0;i<90;i++) { const y=rand(i*4+tick)*h, x=rand(i*9+tick)*w, len=(.02+rand(i+tick*3)*.7)*w;ctx.fillStyle=`rgba(255,255,255,${.1+rand(i+tick)*.8})`;ctx.fillRect(x,y,len,1+rand(i+12)*12*(.5+energy)); }
    for(let i=0;i<12;i++){stroke(fg,.3+rand(i+tick)*.65,2+hit*4);const y=rand(i*5+tick)*h;line(fg,0,y,w*(.3+rand(i+tick)*.7),y);}
  } else if(style === "d") {
    for(let i=0;i<23;i++){let r=((i/23+time*.12)%1)*w*.7;stroke(ctx,.15+(r/w)*.8,1+r/w*5);ctx.beginPath();ctx.ellipse(w/2,h/2,r*pulse,r*.55*pulse,0,0,tau);ctx.stroke();}
    for(let i=0;i<5;i++){const r=((i/5+time*.2)%1)*w*.8;stroke(fg,.5,3);fg.beginPath();fg.ellipse(w/2,h/2,r,r*.55,0,0,tau);fg.stroke();}
  } else if(style === "e") {
    for(let i=0;i<22;i++){const z=(i/22+time*.14)%1,r=25+z*z*w*.75;stroke(ctx,.1+z*.8,1+z*3);poly(ctx,w/2,h/2,r,4,time*.15,.62);}
    for(let i=0;i<6;i++){const z=(i/6+time*.22)%1;stroke(fg,.35+z*.4,3);poly(fg,w/2,h/2,100+z*z*w,4,-time*.08,.62);}
  } else if(style === "f") {
    const horizon=h*.32;stroke(ctx,.55,1.4);
    for(let i=0;i<30;i++){const z=(i/30+time*.13)%1,y=horizon+z*z*h*.85;line(ctx,0,y,w,y);}
    for(let i=-16;i<=16;i++)line(ctx,w/2+i*8,horizon,w/2+i*w*.11,h*1.2);
    stroke(fg,.5,2);for(let i=0;i<5;i++){const z=(i/5+time*.21)%1;line(fg,0,horizon+z*z*h,w,horizon+z*z*h);}
  } else if(style === "g") {
    for(let i=0;i<145;i++){const x=rand(i+20)*w,y=(rand(i+71)*h+time*(140+rand(i+3)*340))%(h+150)-100,len=12+rand(i+8)*150;stroke(ctx,.15+rand(i+5)*.7,1+rand(i)*2);line(ctx,x,y,x,y+len*pulse);}
    for(let i=0;i<15;i++){const x=rand(i+500)*w,y=(rand(i+28)*h+time*400)%(h+200)-100;stroke(fg,.65,3);line(fg,x,y,x,y+150);}
  } else if(style === "h") {
    for(let i=0;i<45;i++){const x=rand(i+13)*w,y=rand(i+50)*h,r=(10+rand(i+99)*110)*pulse,a=time*(i%2?.3:-.4)+rand(i)*tau;stroke(ctx,.2+rand(i+11)*.75,1+rand(i+3)*3);poly(ctx,x,y,r,3,a,.6);}
    for(let i=0;i<6;i++){stroke(fg,.4,3);poly(fg,rand(i+2)*w,rand(i+33)*h,100+rand(i+16)*160,3,time*.25+i,.6);}
  } else if(style === "i") {
    const bins=audio?.bands;
    for(let i=0;i<64;i++){const v=bins?.[i] ?? (.2+.55*Math.abs(Math.sin(i*.29+time*2)*Math.cos(i*.17-time)));const height=(.05+v*.75)*h;ctx.fillStyle=`rgba(255,255,255,${.28+v*.65})`;const x=i*w/64;ctx.fillRect(x,h/2-height/2,w/90,height);}
    for(let i=0;i<12;i++){const v=bins?.[i*5] ?? (.25+.5*Math.abs(Math.sin(i+time)));stroke(fg,.5,2);const x=(i+.5)*w/12;line(fg,x,h*.5-v*h*.44,x,h*.5+v*h*.44);}
  } else if(style === "j") {
    const shift=(time*120)%50;for(let i=-3;i<40;i++){const x=i*50+shift;ctx.fillStyle=`rgba(255,255,255,${i%4===0?.75:.22})`;ctx.fillRect(x,0,i%4===0?10:2,h);}
    for(let i=0;i<8;i++){stroke(fg,.55,3);const x=((i/8+time*.12)%1)*w;line(fg,x,0,x,h);}
  } else if(style === "k") {
    for(let i=0;i<20;i++){ctx.save();ctx.translate(w/2,h/2);ctx.rotate(i*pi/20+time*.18);ctx.scale(1,.15+i*.012);stroke(ctx,.2+i*.03,2);ctx.beginPath();ctx.arc(0,0,(250+i*13)*pulse,0,tau);ctx.stroke();ctx.restore();}
    for(let i=0;i<4;i++){fg.save();fg.translate(w/2,h/2);fg.rotate(i*pi/4-time*.22);fg.scale(1,.36);stroke(fg,.55,3);fg.beginPath();fg.arc(0,0,480+i*50,0,tau);fg.stroke();fg.restore();}
  } else if (style === "m") {
    // Pixel noise pulses in irregular, spatially distributed clusters.
    const tick = Math.floor(time * 12);
    for (let i = 0; i < 850; i++) {
      const x = Math.floor(rand(i * 2 + tick * 9) * 96) * w / 96;
      const y = Math.floor(rand(i * 5 + tick * 7) * 48) * h / 48;
      const a = (0.15 + rand(i * 11 + tick) * 0.75) * (0.55 + energy * 0.45);
      ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fillRect(x, y, 2 + rand(i + 9) * 8, 2 + rand(i + 7) * 5);
    }
    for (let i = 0; i < 35; i++) {
      const x = rand(i * 7 + tick) * w, y = rand(i * 5 + tick) * h;
      fg.fillStyle = `rgba(255,255,255,${0.25 + rand(i + tick) * 0.55})`; fg.fillRect(x, y, 4 + rand(i + 2) * 16, 3);
    }
  } else if (style === "n") {
    // Breathing checker grid; nearby squares pass across the front scrim.
    const cols = 32, rows = 16;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const phase = Math.sin(Math.hypot(x - cols / 2, y - rows / 2) * 0.65 - time * 3);
      const size = Math.max(1, (phase + 1) * (4 + bass * 6));
      ctx.fillStyle = `rgba(255,255,255,${0.15 + (phase + 1) * 0.28})`;
      ctx.fillRect((x + 0.5) * w / cols - size / 2, (y + 0.5) * h / rows - size / 2, size, size);
    }
    for (let i = 0; i < 8; i++) { stroke(fg, 0.3, 2); poly(fg, w * (0.15 + i * 0.1), h * 0.5, 30 + 15 * Math.sin(time * 2 + i), 4, pi / 4, 1); }
  } else if (style === "o") {
    // Branching electrical arcs flash on transient energy.
    const tick = Math.floor(time * (6 + hit * 10));
    for (let j = 0; j < 14; j++) {
      const y = rand(j * 41 + tick) * h; stroke(ctx, 0.25 + rand(j + tick) * 0.7, 1 + hit * 4);
      ctx.beginPath(); ctx.moveTo(0, y);
      for (let i = 1; i <= 32; i++) ctx.lineTo(i * w / 32, y + (rand(i * 37 + j * 71 + tick) - 0.5) * (22 + energy * 90));
      ctx.stroke();
    }
    for (let j = 0; j < 3; j++) { stroke(fg, 0.5 + hit * 0.4, 2); const y = h * (0.25 + j * 0.25); line(fg, 0, y, w, y + Math.sin(time * 5 + j) * 45); }
  } else if (style === "p") {
    // Opposing ribbons cross through the stage centre.
    for (let i = 0; i < 36; i++) {
      const y = i * h / 35, sway = Math.sin(time * 1.5 + i * 0.45) * 80 * pulse;
      stroke(ctx, 0.18 + (i % 4 === 0 ? 0.55 : 0.15), i % 4 === 0 ? 3 : 1);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(w * 0.27, y + sway, w * 0.7, h - y - sway, w, h - y); ctx.stroke();
    }
    for (let i = 0; i < 5; i++) { stroke(fg, 0.42, 3); const y = h * (0.1 + i * 0.2); line(fg, 0, y, w, h - y); }
  } else if (style === "q") {
    // Two interwoven spiral arms pull dust into the distance.
    for (let i = 0; i < 750; i++) {
      const r = (0.02 + rand(i + 2) * 0.7) * w, arm = i % 2 * pi;
      const a = r / w * 9 + arm + time * 0.32 + (rand(i + 22) - 0.5) * 0.9;
      const x = w / 2 + Math.cos(a) * r, y = h / 2 + Math.sin(a) * r * 0.48;
      ctx.fillStyle = `rgba(255,255,255,${0.22 + rand(i + 8) * 0.72})`; const sz = 1 + rand(i + 33) * 4; ctx.fillRect(x, y, sz, sz);
    }
    for (let i = 0; i < 5; i++) { stroke(fg, 0.4, 2); fg.beginPath(); fg.ellipse(w / 2, h / 2, 240 + i * 90, 90 + i * 38, time * 0.18, i * 0.4, i * 0.4 + pi * 1.5); fg.stroke(); }
  } else if (style === "r") {
    // Sliced prisms alternate between outline and reflective facets.
    const tick = Math.floor(time * 3);
    for (let i = 0; i < 42; i++) {
      const x = rand(i * 9 + tick) * w, y = rand(i * 7 + tick) * h;
      const size = 15 + rand(i + tick) * 150; stroke(ctx, 0.25 + rand(i + 50) * 0.65, 1.5);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + size, y - size * 0.5); ctx.lineTo(x + size * 0.65, y + size * 0.55); ctx.closePath();
      if (i % 5 === 0) { ctx.fillStyle = `rgba(255,255,255,${0.1 + hit * 0.5})`; ctx.fill(); } ctx.stroke();
    }
    for (let i = 0; i < 4; i++) { stroke(fg, 0.5, 2); poly(fg, w * (0.2 + i * 0.2), h * 0.5, 160, 3, time * 0.2 + i, 0.65); }
  } else if (style === "s") {
    // A pair of strands pass through each other with connecting rungs.
    for (let j = 0; j < 2; j++) {
      stroke(ctx, 0.8, 4); ctx.beginPath();
      for (let i = 0; i <= 150; i++) { const x = i * w / 150, y = h * 0.5 + Math.sin(i * 0.09 - time * 2 + j * pi) * h * 0.3 * pulse; if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke();
    }
    for (let i = 0; i < 45; i++) { const x = i * w / 44, y = Math.sin(i * 0.31 - time * 2) * h * 0.3 * pulse; stroke(ctx, 0.25 + Math.abs(y / h), 2); line(ctx, x, h * 0.5 + y, x, h * 0.5 - y); }
    for (let i = 0; i < 6; i++) { const x = (i + 0.5) * w / 6, y = Math.sin(time * 2 + i) * h * 0.3; stroke(fg, 0.5, 3); line(fg, x, h * 0.5 - y, x, h * 0.5 + y); }
  } else if (style === "t") {
    // Oscilloscope lines use live bands when present.
    for (let j = 0; j < 7; j++) {
      stroke(ctx, 0.25 + j * 0.1, 1 + (j % 3)); ctx.beginPath();
      for (let i = 0; i <= 160; i++) {
        const band = audio?.bands?.[i % 64] ?? 0.4, x = i * w / 160;
        const y = h * (0.2 + j * 0.1) + Math.sin(i * 0.17 - time * 4 + j) * (12 + band * 95) * pulse;
        if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      } ctx.stroke();
    }
    stroke(fg, 0.55, 3); fg.beginPath(); for (let i = 0; i <= 100; i++) { const x = i * w / 100, y = h / 2 + Math.sin(i * 0.25 - time * 3) * (30 + bass * 90); if (!i) fg.moveTo(x, y); else fg.lineTo(x, y); } fg.stroke();
  } else if (style === "u") {
    // An expanding field of concentric halftone dots.
    const spacing = 25;
    for (let y = 0; y < h; y += spacing) for (let x = 0; x < w; x += spacing) {
      const d = Math.hypot((x - w / 2) * 0.6, y - h / 2), v = (1 + Math.sin(d * 0.035 - time * 3)) / 2;
      const size = 1 + v * (5 + bass * 5); ctx.fillStyle = `rgba(255,255,255,${0.12 + v * 0.7})`; ctx.fillRect(x - size / 2, y - size / 2, size, size);
    }
    for (let i = 0; i < 4; i++) { stroke(fg, 0.4, 2); fg.beginPath(); const r = 100 + ((i / 4 + time * 0.1) % 1) * 550; fg.ellipse(w / 2, h / 2, r, r * 0.52, 0, 0, tau); fg.stroke(); }
  } else if (style === "v") {
    // Curtains of hanging light sway at different speeds.
    for (let i = 0; i < 90; i++) {
      const x = (i + 0.5) * w / 90, bend = Math.sin(i * 0.3 + time * 1.2) * 55;
      stroke(ctx, 0.12 + rand(i + 4) * 0.65, 1 + rand(i) * 2); ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + bend, h * 0.35, x - bend, h * 0.65, x + bend * 0.3, h); ctx.stroke();
      const y = (rand(i + 50) * h + time * (80 + rand(i) * 160)) % h; ctx.fillStyle = "#fff"; ctx.fillRect(x + Math.sin(y / h * pi) * bend - 2, y, 4, 8);
    }
    for (let i = 0; i < 7; i++) { const x = (i + 0.5) * w / 7; stroke(fg, 0.45, 2); line(fg, x, 0, x + Math.sin(time + i) * 60, h); }
  } else if (style === "w") {
    for (let i = -35; i < 70; i++) {
      const offset = (time * 80) % 55, x = i * 55 + offset; stroke(ctx, i % 5 === 0 ? 0.7 : 0.2, i % 5 === 0 ? 3 : 1);
      line(ctx, x, 0, x + h * 0.9, h); line(ctx, w - x, 0, w - x - h * 0.9, h);
    }
    for (let i = 0; i < 5; i++) { stroke(fg, 0.4, 2); const x = (i / 5 + time * 0.08) % 1 * w; line(fg, x, 0, x + h * 0.6, h); }
  } else if (style === "x") {
    for (let i = 0; i < 24; i++) { const x = (i / 24 + time * 0.05) % 1 * w; stroke(ctx, 0.2 + (i % 4 === 0 ? 0.55 : 0), 1 + (i % 4 === 0 ? 4 : 0)); line(ctx, x - h * 0.55, 0, x + h * 0.55, h); line(ctx, x + h * 0.55, 0, x - h * 0.55, h); }
    for (let i = 0; i < 3; i++) { stroke(fg, 0.5, 3); const x = w * (0.2 + i * 0.3); line(fg, x - 200, 0, x + 200, h); line(fg, x + 200, 0, x - 200, h); }
  } else if (style === "y") {
    for (let i = 0; i < 70; i++) {
      const x = rand(i + 40) * w, y = rand(i + 80) * h, phase = (rand(i + 15) + time * 0.22) % 1;
      const radius = 4 + phase * (45 + rand(i + 2) * 90); stroke(ctx, (1 - phase) * 0.75, 1 + (1 - phase) * 3);
      ctx.beginPath(); ctx.arc(x, y, radius * pulse, 0, tau); ctx.stroke();
    }
    for (let i = 0; i < 6; i++) { const p = (i / 6 + time * 0.15) % 1; stroke(fg, (1 - p) * 0.6, 2); fg.beginPath(); fg.arc(rand(i + 4) * w, rand(i + 24) * h, 20 + p * 180, 0, tau); fg.stroke(); }
  } else if (style === "z") {
    // A radial fan and expanding wavefronts provide a strong finale.
    for (let i = 0; i < 72; i++) {
      const a = i * tau / 72 + time * 0.1, inner = 30 + (i % 5) * 18;
      stroke(ctx, 0.18 + (i % 6 === 0 ? 0.7 : 0.2) + hit * 0.1, i % 6 === 0 ? 4 : 1);
      line(ctx, w / 2 + Math.cos(a) * inner, h / 2 + Math.sin(a) * inner, w / 2 + Math.cos(a) * w, h / 2 + Math.sin(a) * w);
    }
    for (let i = 0; i < 8; i++) { const p = (i / 8 + time * 0.2) % 1; stroke(ctx, (1 - p) * 0.8, 2 + hit * 6); poly(ctx, w / 2, h / 2, 50 + p * w * 0.7 * pulse, 6, time * 0.1, 0.55); }
    for (let i = 0; i < 4; i++) { const p = (i / 4 + time * 0.3) % 1; stroke(fg, (1 - p) * 0.75, 4); poly(fg, w / 2, h / 2, 100 + p * w * 0.8, 3, -pi / 2, 0.6); }
  }
  ctx.restore();fg.restore();
}
