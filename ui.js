// ui.js — render loop: fixed-timestep physics, rAF rendering. y-down everywhere.
const canvas = document.getElementById('c'), dpr = devicePixelRatio || 1;
canvas.width = W*dpr; canvas.height = HGT*dpr;   // CSS scales it responsively
const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
const canvasX = e => e.offsetX * W / canvas.clientWidth;

const sObs = document.getElementById('sobs'), sAcc = document.getElementById('sacc');
const strip = { x: W*0.58, w: 150, on: false };
const occBox = document.getElementById('occ');
occBox.onchange = () => strip.on = occBox.checked;
const readout = id => document.getElementById(id);
function params() {
  world.sigObs = +sObs.value; world.sigA = +sAcc.value;
  readout('vobs').textContent = sObs.value; readout('vacc').textContent = sAcc.value;
}
sObs.oninput = sAcc.oninput = params; params();

let kf = kfInit(...world.measure());
const dots = [], track = [];

function step() {
  world.step(DT);
  kfPredict(kf, DT, world.sigA);
  if (strip.on && Math.abs(world.x[0] - strip.x) < strip.w/2) {
    readout('innov').textContent = 'occluded';       // no measurement: predict only,
  } else {                                           // never feed z = 0
    const z = world.measure();
    const { nu } = kfUpdate(kf, z, world.sigObs);
    readout('innov').textContent = Math.hypot(...nu).toFixed(1) + ' px';
    dots.push(z); if (dots.length > 90) dots.shift();
  }
  track.push([kf.x[0], kf.x[1]]); if (track.length > 200) track.shift();
}

function render() {
  ctx.fillStyle = '#0B0E14'; ctx.fillRect(0, 0, W, HGT);
  if (strip.on) {                                            // the dark zone
    ctx.fillStyle = 'rgba(20,25,34,0.9)'; ctx.fillRect(strip.x - strip.w/2, 0, strip.w, HGT);
  }
  ctx.fillStyle = 'rgba(230,234,242,0.25)';                  // true ball, faint
  ctx.beginPath(); ctx.arc(world.x[0], world.x[1], BALL, 0, 7); ctx.fill();
  dots.forEach(([x, y], i) => {                              // measurement scatter
    ctx.fillStyle = `rgba(138,147,166,${0.1 + 0.5*i/dots.length})`;
    ctx.fillRect(x-1.5, y-1.5, 3, 3);
  });
  ctx.strokeStyle = '#4FD6C4'; ctx.lineWidth = 2;            // the belief, solid
  ctx.beginPath(); track.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.stroke();
  const a = kf.P[0], b = kf.P[1], c = kf.P[5];               // 95% ellipse from the
  const m = (a+c)/2, d = Math.hypot((a-c)/2, b);             // position block of P
  ctx.strokeStyle = 'rgba(79,214,196,0.55)'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(kf.x[0], kf.x[1], 2*Math.sqrt(m+d), 2*Math.sqrt(Math.max(m-d, 1e-9)),
              0.5*Math.atan2(2*b, a-c), 0, 7);
  ctx.stroke();
}

function reset(seed) {
  world.reset(seed); kf = kfInit(...world.measure());
  dots.length = 0; track.length = 0;
}
function setp(so, sa, occ) {
  sObs.value = so; sAcc.value = sa; occBox.checked = occ; strip.on = occ; params();
}
const presets = {              // each teaches one thing
  noisy:   () => { setp(35, 25, false); reset(11); },
  occlude: () => { setp(12, 25, true); strip.x = W*0.58; reset(1); },
  ghost:   () => { setp(10, 1, false); reset(5); },       // Q≈0 meets a wall
  kidnap:  () => { setp(12, 25, false); world.kidnap(); },
};
const CAP = {
  noisy: 'σ_obs at 35: the dots are a storm, the belief is calm. Filtering is a principled average over time.',
  occlude: 'Measurements stop inside the strip. The filter predicts blind, the ellipse balloons, and the first dot on the far side snaps it tight. Drag the strip.',
  ghost: 'σ_a near zero declares the model perfect. But the model does not know about walls: the estimate sails through like a ghost, then slowly concedes to the dots.',
  kidnap: 'The ball teleported. The innovation spikes, the gain does its job, and the belief gets dragged back to the evidence.',
};
document.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => {
  presets[b.dataset.preset]();
  readout('cap').textContent = CAP[b.dataset.preset];
  document.querySelectorAll('[data-preset]').forEach(x => x.classList.toggle('on', x === b));
});

let drag = false;
canvas.onpointerdown = e => { if (strip.on && Math.abs(canvasX(e) - strip.x) < strip.w/2) drag = true; };
canvas.onpointermove = e => { if (drag) strip.x = canvasX(e); };
canvas.onpointerup = () => drag = false;

let acc = 0, last = performance.now();
function frame(now) {
  acc += (now - last)/1000; last = now;
  while (acc >= DT) { step(); acc -= DT; }
  render(); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
