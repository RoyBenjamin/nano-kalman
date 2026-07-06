// ui.js — render loop: fixed-timestep physics, rAF rendering. y-down everywhere.
const canvas = document.getElementById('c'), dpr = devicePixelRatio || 1;
canvas.width = W*dpr; canvas.height = HGT*dpr;
canvas.style.width = W+'px'; canvas.style.height = HGT+'px';
const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);

const dots = [];   // recent measurements, oldest first

function step() {
  world.step(DT);
  dots.push(world.measure());
  if (dots.length > 90) dots.shift();
}

function render() {
  ctx.fillStyle = '#0B0E14'; ctx.fillRect(0, 0, W, HGT);
  ctx.fillStyle = 'rgba(230,234,242,0.25)';                  // true ball, faint
  ctx.beginPath(); ctx.arc(world.x[0], world.x[1], BALL, 0, 7); ctx.fill();
  dots.forEach(([x, y], i) => {                              // measurement scatter
    ctx.fillStyle = `rgba(138,147,166,${0.1 + 0.5*i/dots.length})`;
    ctx.fillRect(x-1.5, y-1.5, 3, 3);
  });
}

let acc = 0, last = performance.now();
function frame(now) {
  acc += (now - last)/1000; last = now;
  while (acc >= DT) { step(); acc -= DT; }
  render(); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
