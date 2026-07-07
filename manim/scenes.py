# manim/scenes.py — the repo's math in motion. Text() only: no LaTeX dependency.
# Render: uv run --group docs manim -qm --format=gif --media_dir manim/out manim/scenes.py <Scene>
import numpy as np
from manim import *

BG, ACCENT, TXT, MUTED = "#0B0E14", "#4FD6C4", "#E6EAF2", "#8A93A6"
config.background_color = BG


class GainBlend(Scene):
    """The 1D update: the posterior is an inverse-variance blend, and the gain
    K = sig_prior^2 / (sig_prior^2 + sig_obs^2) slides between the two beliefs."""
    def construct(self):
        MU0, SIG0, Z, BASE, SC = -2.5, 1.4, 2.5, -1.3, 1.5
        so = ValueTracker(1.4)
        K = lambda: SIG0**2 / (SIG0**2 + so.get_value()**2)
        mu = lambda: MU0 + K() * (Z - MU0)
        sig = lambda: np.sqrt((1 - K()) * SIG0**2)

        def bell(mu_, sig_, color, w=3):
            return FunctionGraph(
                lambda x: BASE + SC / (sig_ * np.sqrt(2*np.pi)) * np.exp(-0.5*((x-mu_)/sig_)**2),
                x_range=[-6.5, 6.5], color=color, stroke_width=w)

        prior = bell(MU0, SIG0, MUTED)
        meas = always_redraw(lambda: bell(Z, so.get_value(), TXT))
        post = always_redraw(lambda: bell(mu(), sig(), ACCENT, w=5))
        lp = Text("prior", font_size=26, color=MUTED).move_to([MU0, 0.6, 0])
        lz = Text("measurement", font_size=26, color=TXT).move_to([Z + 1.2, 1.05, 0])
        lpost = always_redraw(lambda: Text("posterior", font_size=26, color=ACCENT)
                              .move_to([mu(), min(BASE + SC/(sig()*np.sqrt(2*np.pi)) + 0.35, 0.5), 0]))
        title = Text("one Kalman update: inverse-variance blending",
                     font_size=30, color=TXT).to_edge(UP, buff=0.5)
        bar = Line([-2, -2.5, 0], [2, -2.5, 0], color=MUTED, stroke_width=2)
        l0 = Text("0 · trust the model", font_size=20, color=MUTED).next_to(bar, LEFT, buff=0.3)
        l1 = Text("1 · trust the sensor", font_size=20, color=MUTED).next_to(bar, RIGHT, buff=0.3)
        kdot = always_redraw(lambda: Dot([-2 + 4*K(), -2.5, 0], color=ACCENT, radius=0.09))
        klab = always_redraw(lambda: Text(f"K = {K():.2f}", font_size=26, color=ACCENT)
                             .next_to(bar, DOWN, buff=0.25))
        self.play(Create(prior), Create(meas), FadeIn(lp, lz, title), run_time=1.2)
        self.play(Create(post), FadeIn(lpost, bar, l0, l1, kdot, klab), run_time=1.2)
        self.wait(0.5)
        self.play(so.animate.set_value(0.45), run_time=2.5)   # sharp sensor: K -> 1
        self.wait(0.7)
        self.play(so.animate.set_value(3.2), run_time=2.5)    # noisy sensor: K -> 0
        self.wait(0.7)
        self.play(so.animate.set_value(1.0), run_time=1.5)
        self.wait(1)


class EllipseBreathes(Scene):
    """Predict steps inflate the covariance ellipse; one measurement snaps it tight.
    A real 4D constant-velocity Kalman filter runs underneath."""
    def construct(self):
        dt, sa, so = 0.4, 0.9, 0.35
        F = np.array([[1,0,dt,0],[0,1,0,dt],[0,0,1,0],[0,0,0,1]])
        q4, q3, q2 = sa*sa*dt**4/4, sa*sa*dt**3/2, sa*sa*dt*dt
        Q = np.array([[q4,0,q3,0],[0,q4,0,q3],[q3,0,q2,0],[0,q3,0,q2]])
        Hm, R = np.array([[1.,0,0,0],[0,1,0,0]]), np.eye(2)*so*so
        rng = np.random.default_rng(3)
        truth = np.array([-4.2, -0.9]); vel = np.array([1.9, 0.42])
        x = np.array([-4.2, -0.9, 1.9, 0.42]); P = np.diag([.25, .25, .3, .3])

        def ell(x_, P_, k=2.0):
            a, b, c = P_[0,0], P_[0,1], P_[1,1]
            m, d = (a+c)/2, float(np.hypot((a-c)/2, b))
            return (Ellipse(width=2*k*np.sqrt(m+d), height=2*k*np.sqrt(max(m-d, 1e-9)),
                            color=ACCENT, stroke_width=3)
                    .rotate(0.5*np.arctan2(2*b, a-c)).move_to([x_[0], x_[1], 0]))

        est = Dot([x[0], x[1], 0], color=ACCENT, radius=0.09)
        tru = Dot([truth[0], truth[1], 0], color=TXT, radius=0.11, fill_opacity=0.35)
        e = ell(x, P)
        cap = Text("measurements arriving: the belief stays tight", font_size=26, color=MUTED).to_edge(DOWN, buff=0.5)
        self.add(tru, e, est, cap); self.wait(0.6)
        phases = ["u"]*3 + ["p"]*6 + ["u"]*2
        for i, ph in enumerate(phases):
            truth = truth + vel*dt
            x, P = F @ x, F @ P @ F.T + Q
            if ph == "u":
                z = truth + rng.normal(0, so, 2)
                S = Hm @ P @ Hm.T + R
                Kg = P @ Hm.T @ np.linalg.inv(S)
                x = x + Kg @ (z - Hm @ x); P = (np.eye(4) - Kg @ Hm) @ P
                zdot = Square(0.12, color=TXT, fill_opacity=1).move_to([z[0], z[1], 0])
                self.play(tru.animate.move_to([truth[0], truth[1], 0]), FadeIn(zdot, run_time=0.15),
                          Transform(e, ell(x, P)), est.animate.move_to([x[0], x[1], 0]), run_time=0.5)
                self.play(FadeOut(zdot), run_time=0.2)
            else:
                self.play(tru.animate.move_to([truth[0], truth[1], 0]),
                          Transform(e, ell(x, P)), est.animate.move_to([x[0], x[1], 0]), run_time=0.5)
            if i == 2:
                self.play(Transform(cap, Text("occlusion: no measurements — predict only, P grows",
                                              font_size=26, color=TXT).to_edge(DOWN, buff=0.5)), run_time=0.5)
            if i == 8:
                self.play(Transform(cap, Text("reacquired: one update snaps the belief tight",
                                              font_size=26, color=ACCENT).to_edge(DOWN, buff=0.5)), run_time=0.5)
        self.wait(1.2)
