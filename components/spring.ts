/**
 * A damped spring sampled into keyframes for the Web Animations API, so a
 * release carries the finger's speed into the settle (no animation library).
 *
 * `response` is the period in seconds (Apple's SwiftUI parameter), `damping`
 * the damping fraction (1 = critically damped, < 1 overshoots slightly).
 * `velocity` is the starting speed in progress units per second.
 */
export interface SpringOptions {
  response?: number;
  damping?: number;
  velocity?: number;
}

const FRAME_MS = 16;

export function springSamples({ response = 0.45, damping = 0.88, velocity = 0 }: SpringOptions = {}) {
  const stiffness = (2 * Math.PI / response) ** 2;
  const friction = 2 * damping * Math.sqrt(stiffness);
  let x = 0;
  let v = velocity;
  const samples = [0];
  const step = 1 / 1000; // integrate at 1ms
  for (let t = 1; t <= 1500; t++) {
    const a = -stiffness * (x - 1) - friction * v;
    v += a * step;
    x += v * step;
    if (t % FRAME_MS === 0) samples.push(x);
    // Stop once the rest is invisible (well under a pixel on a phone-width move).
    if (t > 60 && Math.abs(x - 1) < 0.004 && Math.abs(v) < 0.2) break;
  }
  samples.push(1);
  return { samples, duration: samples.length * FRAME_MS };
}

/** Velocity in px/ms along a distance in px → progress units per second. */
export function progressVelocity(pxPerMs: number, distancePx: number) {
  if (!distancePx) return 0;
  return Math.max(-40, Math.min(40, (pxPerMs * 1000) / distancePx));
}

/** Runs a spring on one element by mapping progress to a style for each frame. */
export function animateSpring(
  el: Element,
  frame: (p: number) => Keyframe,
  options: SpringOptions = {}
) {
  const { samples, duration } = springSamples(options);
  return el.animate(samples.map(frame), { duration, easing: 'linear', fill: 'forwards' });
}

export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/**
 * Resolves when the animation ends, or shortly after its planned duration if
 * the page stops rendering frames (hidden or throttled tabs never resolve
 * `finished` until they paint again).
 */
export function settled(a: Animation): Promise<void> {
  const ms = Number(a.effect?.getTiming().duration) || 0;
  return Promise.race([
    a.finished.then(() => undefined, () => undefined),
    new Promise<void>(r => setTimeout(r, ms + 60)),
  ]);
}
