// Turns stored per-photo dominant colors into a small palette for the ambient
// page glow. Pure and dependency-free so it can run on the server and in tests.

type Hsl = { h: number; s: number; l: number };

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

function hexToHsl(hex: string): Hsl | null {
  const m = HEX.exec(hex.trim());
  if (!m) return null;
  let v = m[1];
  if (v.length === 3) v = v.split('').map(c => c + c).join('');
  const r = parseInt(v.slice(0, 2), 16) / 255;
  const g = parseInt(v.slice(2, 4), 16) / 255;
  const b = parseInt(v.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

function hslToHex({ h, s, l }: Hsl): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const to = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

const hueGap = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/** Below this saturation a color reads as neutral, and its hue means nothing. */
const NEUTRAL = 0.12;
const BIN = 30; // hue bucket width in degrees

/** Chroma that reads in a photo: saturated, and neither near-black nor near-white. */
const presence = (c: Hsl) => c.s * (1 - Math.min(1, Math.abs(c.l - 0.5) * 1.6));

function meanColor(group: Hsl[]): Hsl {
  let x = 0, y = 0, s = 0, l = 0, w = 0;
  for (const c of group) {
    const wt = presence(c) + 0.001;
    x += Math.cos((c.h * Math.PI) / 180) * wt;
    y += Math.sin((c.h * Math.PI) / 180) * wt;
    s += c.s * wt;
    l += c.l * wt;
    w += wt;
  }
  return { h: ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360, s: s / w, l: l / w };
}

/**
 * Picks up to `count` colors that represent a set of photos. Hues are bucketed
 * and ranked by how much visible color each bucket holds across the set, so a
 * forest shoot glows green rather than taking the one red jacket. Each pick is
 * lifted to a lightness and saturation that reads as light rather than mud;
 * mostly gray sets stay mostly gray. Returns [] when there is nothing usable.
 */
export function glowPalette(hexes: ReadonlyArray<string | null | undefined>, count = 4): string[] {
  const colors = hexes.flatMap(h => {
    const hsl = h ? hexToHsl(h) : null;
    return hsl ? [hsl] : [];
  });
  if (colors.length === 0 || count <= 0) return [];

  const bins = new Map<number, Hsl[]>();
  const neutrals: Hsl[] = [];
  for (const c of colors) {
    if (c.s < NEUTRAL) { neutrals.push(c); continue; }
    const k = Math.floor(c.h / BIN) % (360 / BIN);
    bins.set(k, [...(bins.get(k) ?? []), c]);
  }

  const weight = (g: Hsl[]) => g.reduce((sum, c) => sum + presence(c), 0);
  const ranked = Array.from(bins.values())
    .map(g => ({ color: meanColor(g), weight: weight(g) }))
    .sort((a, b) => b.weight - a.weight);

  const picked: Hsl[] = [];
  for (const { color } of ranked) {
    if (picked.length >= count) break;
    if (picked.every(p => hueGap(p.h, color.h) >= 20)) picked.push(color);
  }
  // A mostly gray set gets its gray in a minor slot (the third, the dimmest
  // light) so the glow stays honest to it without going dull.
  if (neutrals.length > 0 && (picked.length < count || neutrals.length > colors.length * 0.6)) {
    picked.length = Math.min(picked.length, count - 1);
    picked.splice(Math.min(2, picked.length), 0, meanColor(neutrals));
  }
  for (let i = 0; picked.length < count; i++) picked.push(picked[i % picked.length]);

  return picked.map(c =>
    hslToHex({
      h: c.h,
      s: c.s < NEUTRAL ? c.s : Math.min(0.62, c.s * 1.6 + 0.08),
      l: Math.min(0.58, Math.max(0.42, c.l)),
    })
  );
}
