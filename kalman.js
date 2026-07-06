// kalman.js — the whole filter: predict, update, and just enough matrix algebra.
// Matrices are flat row-major arrays. The only inverse ever needed is 2×2.

const matmul = (A, B, n, m, p) => {          // (n×m)(m×p) → n×p
  const C = new Array(n*p).fill(0);
  for (let i = 0; i < n; i++) for (let k = 0; k < m; k++)
    for (let j = 0; j < p; j++) C[i*p+j] += A[i*m+k]*B[k*p+j];
  return C;
};
const transpose = (A, n, m) => {
  const T = new Array(n*m);
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) T[j*n+i] = A[i*m+j];
  return T;
};
const add = (A, B) => A.map((v, i) => v + B[i]);
const inv2 = ([a, b, c, d]) => {             // closed form: adjugate over determinant
  const det = a*d - b*c, s = 1/(Math.abs(det) < 1e-12 ? 1e-12 : det);
  return [d*s, -b*s, -c*s, a*s];
};

const KH = [1,0,0,0, 0,1,0,0];               // H: we observe position only
const I4 = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];

function kfInit(px, py, p0 = 500) {
  return { x: [px, py, 0, 0],
           P: [p0,0,0,0, 0,p0,0,0, 0,0,p0,0, 0,0,0,p0] };
}

function kfPredict(kf, dt, sigA) {           // x̂⁻ = F x̂     P⁻ = F P Fᵀ + Q
  const F = [1,0,dt,0, 0,1,0,dt, 0,0,1,0, 0,0,0,1];
  const v = sigA*sigA, q4 = v*dt**4/4, q3 = v*dt**3/2, q2 = v*dt*dt;
  const Q = [q4,0,q3,0, 0,q4,0,q3, q3,0,q2,0, 0,q3,0,q2];
  kf.x = matmul(F, kf.x, 4, 4, 1);
  kf.P = add(matmul(matmul(F, kf.P, 4, 4, 4), transpose(F, 4, 4), 4, 4, 4), Q);
}

function kfUpdate(kf, z, sigObs) {           // K = P⁻Hᵀ(HP⁻Hᵀ+R)⁻¹, then blend
  const R = [sigObs*sigObs, 0, 0, sigObs*sigObs];
  const PHt = matmul(kf.P, transpose(KH, 2, 4), 4, 4, 2);
  const Si = inv2(add(matmul(KH, PHt, 2, 4, 2), R));
  const K = matmul(PHt, Si, 4, 2, 2);
  const nu = [z[0] - kf.x[0], z[1] - kf.x[1]];         // innovation z − H x̂⁻
  kf.x = add(kf.x, matmul(K, nu, 4, 2, 1));            // x̂ = x̂⁻ + K ν
  const IKH = add(I4, matmul(K, KH, 4, 2, 4).map(v => -v));
  kf.P = matmul(IKH, kf.P, 4, 4, 4);                   // P = (I − KH) P⁻
  for (let i = 0; i < 4; i++) for (let j = 0; j < i; j++)          // keep P symmetric
    kf.P[i*4+j] = kf.P[j*4+i] = (kf.P[i*4+j] + kf.P[j*4+i])/2;
  return { nu, nis: nu[0]*(Si[0]*nu[0] + Si[1]*nu[1])             // NIS: νᵀ S⁻¹ ν
              + nu[1]*(Si[2]*nu[0] + Si[3]*nu[1]) };
}
