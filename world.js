// world.js — the truth: a ball with constant-velocity dynamics plus white-noise
// acceleration, bouncing off walls. The filter never sees this state, only measure().
function mulberry32(a){return function(){var t=a+=0x6D2B79F5;
  t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);
  return((t^t>>>14)>>>0)/4294967296}}
const gauss = rng => Math.sqrt(-2*Math.log(1-rng()))*Math.cos(2*Math.PI*rng());

const DT = 1/60, W = 880, HGT = 520, BALL = 9;

const world = {
  sigObs: 12, sigA: 25,
  reset(seed = 1) {
    this.rng = mulberry32(seed);
    this.x = [W*0.22, HGT*0.62, 130, -85];
  },
  step(dt) {   // the same white-noise-acceleration model the filter's Q assumes
    const s = this.x, ax = gauss(this.rng)*this.sigA, ay = gauss(this.rng)*this.sigA;
    s[0] += s[2]*dt + 0.5*ax*dt*dt; s[1] += s[3]*dt + 0.5*ay*dt*dt;
    s[2] += ax*dt; s[3] += ay*dt;
    if (s[0] < BALL)     { s[0] = 2*BALL - s[0];       s[2] = -s[2]; }
    if (s[0] > W-BALL)   { s[0] = 2*(W-BALL) - s[0];   s[2] = -s[2]; }
    if (s[1] < BALL)     { s[1] = 2*BALL - s[1];       s[3] = -s[3]; }
    if (s[1] > HGT-BALL) { s[1] = 2*(HGT-BALL) - s[1]; s[3] = -s[3]; }
  },
  measure() {   // noisy position only — Gaussian, or the NIS oracle won't calibrate
    return [this.x[0] + gauss(this.rng)*this.sigObs,
            this.x[1] + gauss(this.rng)*this.sigObs];
  },
  kidnap() {
    this.x[0] = W*(0.15 + 0.7*this.rng());
    this.x[1] = HGT*(0.15 + 0.7*this.rng());
  },
};
world.reset();
