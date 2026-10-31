// Original monochrome visual instruments for live stage use.
export const VISUAL_STYLES = [
  ["a", "流体波纹"], ["b", "粒子星河"], ["c", "故障切片"],
  ["d", "脉冲圆环"], ["e", "穿梭隧道"], ["f", "数字地形"],
  ["g", "垂直光雨"], ["h", "几何碎片"], ["i", "音频频谱"],
  ["j", "扫描光栅"], ["k", "原子轨迹"], ["l", "等高线场"],
];

export function drawVisualStyle(ctx, fg, style, time, audio) {
  const w = ctx.canvas.width, h = ctx.canvas.height, pi = Math.PI, tau = pi * 2;
  const rand = (n) => { const x = Math.sin(n * 127.1 + 13.37) * 43758.5453; return x - Math.floor(x); };
  const energy = audio ? audio.energy : 0.45, bass = audio ? audio.bass : 0.4, hit = audio ? audio.impact : 0;
  const pulse = 1 + bass * 0.16 + hit * 0.12;
  const stroke = (c, alpha = 1, width = 1) => { c.strokeStyle = `rgba(255,255,255,${alpha})`; c.lineWidth = width; };
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
  }
  ctx.restore();fg.restore();
}
