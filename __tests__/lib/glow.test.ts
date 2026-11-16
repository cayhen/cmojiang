import { glowPalette } from '@/lib/glow';

const hue = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return null;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};

describe('glowPalette', () => {
  it('returns no glow when there are no usable colors', () => {
    expect(glowPalette([])).toEqual([]);
    expect(glowPalette([null, undefined, 'not-a-color', '#12'])).toEqual([]);
  });

  it('always fills the requested number of slots', () => {
    const out = glowPalette(['#3366cc']);
    expect(out).toHaveLength(4);
    expect(new Set(out).size).toBe(1);
  });

  it('puts the most chromatic mid-tone first and skips near-duplicate hues', () => {
    const out = glowPalette(['#141413', '#2a5db0', '#2d5fb2', '#b0702a', '#7a7a7a'], 3);
    expect(hue(out[0])).toBeGreaterThan(200); // the blue
    expect(hue(out[0])).toBeLessThan(230);
    expect(hue(out[1])).toBeGreaterThan(20); // then the amber, not the second blue
    expect(hue(out[1])).toBeLessThan(40);
  });

  it('leads with the hue that fills the set, not the single loudest swatch', () => {
    const forest = Array.from({ length: 12 }, () => '#4f6b3a');
    const out = glowPalette([...forest, '#c0281b'], 2);
    expect(hue(out[0])).toBeGreaterThan(80); // green
    expect(hue(out[0])).toBeLessThan(120);
    expect(hue(out[1])).toBeLessThan(15); // the red still gets a slot
  });

  it('keeps neutral sets neutral and lifts their lightness out of the mud', () => {
    const out = glowPalette(['#141413', '#27272b', '#1c1c1c']);
    for (const c of out) {
      const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16);
      expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(20);
      expect((r + g + b) / 3).toBeGreaterThan(100);
    }
  });

  it('accepts three-digit hex', () => {
    expect(glowPalette(['#c63'], 1)[0]).toMatch(/^#[0-9a-f]{6}$/);
  });
});
