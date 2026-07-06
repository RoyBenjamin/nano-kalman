# nano-kalman — SPEC

A Kalman filter from scratch, tracking a noisy ball in the browser. The filter itself is about 60 lines; everything else is stagecraft. The README derives the five equations from first principles and makes one argument: **agents act on beliefs, not observations**, and the Kalman filter is the closed-form ancestor of every learned world model. State estimation is the unglamorous infrastructure of physical-world AI, which is exactly the point.

Series note: this is part 1 of the nano world-models trilogy (nano-kalman → nano-jepa → micro-dreamer). The belief-under-occlusion scenario here deliberately mirrors the Latent Playground's occlusion demo: same phenomenon, classical closed form instead of particles.

## Design constraints (the Karpathy contract)

Zero dependencies, vanilla JS plus canvas, no build step, runs from `file://`. **No linear algebra library**: the matrices are 4×4 at worst, and the only inverse needed is 2×2, hand-coded. Budgets: `kalman.js` ≤ 60 lines, total repo ≤ 250. Seeded RNG for reproducible scenarios.

## Repo layout

| File | LOC budget | One idea |
|---|---|---|
| `index.html` | ~50 | Canvas, sliders, preset buttons |
| `kalman.js` | ~60 | Predict, update, 2×2 inverse. The whole filter |
| `world.js` | ~40 | True dynamics, noisy measurement generator, seeded RNG |
| `ui.js` | ~90 | Render loop, uncertainty ellipse, presets |
| `README.md` | — | The derivation essay |

## The model

State is position and velocity in 2D: `x = [px, py, vx, vy]ᵀ`. Constant-velocity dynamics:

```
F = | 1 0 dt 0 |        H = | 1 0 0 0 |      (we observe noisy
    | 0 1 0 dt |            | 0 1 0 0 |       position only)
    | 0 0 1  0 |
    | 0 0 0  1 |        R = σ_obs² · I₂
```

Process noise uses the discrete white-noise-acceleration model per axis, which is the honest 4-line version:

```
Q_axis = σ_a² · | dt⁴/4  dt³/2 |
                | dt³/2  dt²   |
```

## The five equations (`kalman.js`)

```
Predict:   x̂⁻ = F x̂                 P⁻ = F P Fᵀ + Q
Update:    K  = P⁻ Hᵀ (H P⁻ Hᵀ + R)⁻¹
           x̂  = x̂⁻ + K (z − H x̂⁻)
           P  = (I − K H) P⁻
```

`H P⁻ Hᵀ + R` is 2×2, so the inverse is the closed-form `1/det · adj`. Small matrix helpers (`matmul`, `transpose`, `add`, `inv2`) live in the same file, ~30 lines. When no measurement arrives (occlusion), run predict only; `P` grows and the ellipse balloons. That single conditional is the whole occlusion story.

## The demo (`ui.js`)

On one canvas: the true ball (faint), the measurements (scattered dots), the estimate (solid track), and the **uncertainty ellipse** drawn from the position block of `P`. Ellipse from a 2×2 covariance `[[a,b],[b,c]]` in closed form: eigenvalues `(a+c)/2 ± sqrt(((a−c)/2)² + b²)`, angle `0.5·atan2(2b, a−c)`, radii `2√λ` for a ~95% ellipse. Ten lines, no library.

Two sliders, and they are the pedagogical heart: **σ_obs** (trust the sensor) and **σ_a** (trust the model). Everything the filter does is a precision-weighted argument between those two, and the sliders let you feel the Kalman gain move.

A draggable **occlusion strip** where measurements stop arriving. A **kidnap** button that teleports the true ball. A readout of the innovation `|z − H x̂⁻|` so recovery is legible.

## Presets (each one teaches one thing)

1. **Noisy sensor**: crank R. The estimate glides smoothly through a storm of scattered dots. The filter as a principled average over time.
2. **Occlusion**: the ellipse balloons in the dark and snaps tight on reacquisition. Belief maintained without evidence, honestly uncertain.
3. **Overconfident model**: σ_a near zero, then let the ball bounce off a wall. The linear model does not know about walls, so the estimate sails through the wall like a ghost and takes several frames of measurements to concede. Keep this preset; model mismatch shown honestly is worth more than a filter that never fails. The README names it: Q is humility.
4. **Kidnap**: teleport, watch the gain do its job, count frames to recovery at different R.

## README (the derivation essay)

Structure: (1) the state-space model and why Gaussian beliefs stay Gaussian under linear maps; (2) predict as pushing a belief through dynamics; (3) update derived in 1D first, where the gain is just inverse-variance blending, `K = σ_prior² / (σ_prior² + σ_obs²)`, then lifted to matrices; (4) the ellipse as the belief made visible; (5) the bridge paragraph: the KF maintains state in a representation space and only decodes for display, which is exactly what learned world models do, minus the learning. It also states the filter's hard limit, unimodality: a Gaussian cannot represent a fork in possible futures. That limitation is the cliffhanger the next two repos resolve.

## README brief (fill the ship-night template in repo-standard.md)

Punchline: agents act on beliefs, not observations, and the filter is 60 lines. Above the fold: the GainBlend GIF, or the occlusion preset GIF if it reads better small. Essay arc: the 1D gain as inverse-variance blending, the lift to matrices, the ellipse as belief made visible, the bridge to learned world models, the unimodality cliffhanger pointing at the series. Results: measured NIS average beside the theoretical 2, one line per preset. Fence: no EKF, no particles; link the stretch issues and the Latent Playground.

## Tooling, README, and Pages (per repo-standard.md)

MIT, SPEC.md as commit zero, tag `v1.0` at the definition of done. The app stays zero-dependency; Python enters only as documentation tooling in `manim/`, uv-managed under the `docs` group and outside the LOC budget. Two scenes, the repo's math in motion: **GainBlend**, the 1D update as inverse-variance blending, two Gaussians fusing into the posterior as the gain slides between them; **EllipseBreathes**, predict steps inflating the covariance ellipse and one update snapping it tight, the occlusion story with no canvas in sight. Both render to GIFs in `media/` and one sits above the fold in the README, which follows the standard anatomy with the derivation essay as its section four. GitHub Pages serves the repo root, so the project page **is** the live sandbox.

## Implementer's notes

**Oracles, run them in this order.**

1. **NIS consistency** (after build step 2). The normalized innovation squared, `ν = z − H·x̂⁻`, `NIS = νᵀ·S⁻¹·ν` with `S = H·P⁻·Hᵀ + R`, averaged over 500+ steps must sit near 2, the measurement dimension. Persistently low means R is inflated or the filter is lazy; persistently high means overconfidence or a sign/dt bug. Ten lines in a console check, and it catches almost every mistake in this repo.
2. **Zero-noise limit.** Shrink R toward zero: the estimate must lock onto measurements within a frame or two.
3. **Occlusion monotonicity** (after step 3). While measurements are absent, `trace(P)` must strictly increase every frame.

**Traps.**

- Occlusion means **skip the update**, never feed `z = 0`. Feeding zeros makes the estimate dive toward the origin, and it is the single most common bug in student filters.
- Symmetry drift: after each update do `P = (P + Pᵀ)/2`, or spend two extra lines on the Joseph form `P = (I−KH)·P⁻·(I−KH)ᵀ + K·R·Kᵀ`, which is numerically safer.
- Filter `dt` must equal world `dt` exactly; a mismatch presents as estimator lag that looks like a physics bug and wastes an evening.
- Measurement noise must be Gaussian (Box-Muller from the standard), not uniform, or the NIS oracle will not calibrate and you will chase a phantom.
- The 2×2 inverse, explicitly: `inv([[a,b],[c,d]]) = [[d,−b],[−c,a]] / (ad − bc)`. Guard the determinant with an epsilon.
- Canvas y-down negates rotation: if the ellipse tilts against the motion direction, negate the angle at draw time, not in the math.
- Matrices as flat row-major arrays with three tiny helpers (`matmul`, `transpose`, `add`) beats a class hierarchy at this scale.

## Build order

1. World + measurements + canvas. Dots scatter around a moving ball.
2. The filter + estimate track. Sliders wired.
3. Ellipse + occlusion strip.
4. Kidnap, presets, innovation readout, README.

## Definition of done

The occlusion preset shows visible ellipse growth and snap-back. Kidnap recovery is visible and the innovation readout spikes and decays. The bounce preset shows the ghost-through-the-wall failure. Filter file ≤ 60 lines, repo ≤ 250, zero dependencies, runs by double-click. A reader can re-derive the update step from the README without opening another tab.

## Stretch, fenced off

An extended KF with a nonlinear range-bearing sensor. A bounce-aware model (mirror the state at walls). And the best one: a particle filter running side by side, imported conceptually from the Latent Playground, to show exactly where Gaussians die (the fork) and particles survive. None of this before v1 ships.
