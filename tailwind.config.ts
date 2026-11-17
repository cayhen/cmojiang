import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

// Semantic tokens live as CSS variables in app/globals.css so light and dark
// appearance switch with the system setting. Tailwind only names them.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  // hover: styles only on devices that can really hover. On touch screens a
  // tap would otherwise "stick" the hover look, and iOS spends the first tap
  // on hover when it reveals content, so it takes two taps to click.
  future: { hoverOnlyWhenSupported: true },
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        grouped: 'var(--bg-grouped)',
        surface: 'var(--surface)',
        fill: 'var(--fill)',
        fill2: 'var(--fill-2)',
        label: 'var(--label)',
        label2: 'var(--label-2)',
        separator: 'var(--separator)',
        heart: 'var(--heart)',
        destructive: 'var(--destructive)',
        onlabel: 'var(--on-label)',
      },
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"SF Pro Display"', 'system-ui',
          '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif',
        ],
      },
      fontSize: {
        // Page titles from md up: scales with the viewport to 88px on desktop.
        'display': ['clamp(40px, 6.25vw, 88px)', { lineHeight: '1.02', letterSpacing: '-0.035em', fontWeight: '700' }],
        'large-title': ['34px', { lineHeight: '41px', letterSpacing: '-0.022em', fontWeight: '700' }],
        'title1': ['28px', { lineHeight: '34px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'title2': ['22px', { lineHeight: '28px', letterSpacing: '-0.018em', fontWeight: '600' }],
        'title3': ['20px', { lineHeight: '25px', letterSpacing: '-0.016em', fontWeight: '600' }],
        'headline': ['17px', { lineHeight: '22px', letterSpacing: '-0.022em', fontWeight: '600' }],
        'body': ['17px', { lineHeight: '22px', letterSpacing: '-0.022em' }],
        'callout': ['16px', { lineHeight: '21px', letterSpacing: '-0.02em' }],
        'subhead': ['15px', { lineHeight: '20px', letterSpacing: '-0.012em' }],
        'footnote': ['13px', { lineHeight: '18px', letterSpacing: '-0.006em' }],
        'caption': ['12px', { lineHeight: '16px', letterSpacing: '0' }],
      },
      borderRadius: {
        tile: '6px',
        control: '12px',
        card: '14px',
        sheet: '18px',
      },
      boxShadow: {
        float: 'var(--shadow-float)',
      },
      transitionTimingFunction: {
        // iOS sheet/spring-like curve: fast start, long soft settle, no overshoot.
        ios: 'cubic-bezier(0.32, 0.72, 0, 1)',
        out: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [
    // can-hover: for controls that only exist for a mouse or trackpad (the
    // like and download buttons on grid tiles).
    plugin(({ addVariant }) => { addVariant('can-hover', '@media (hover: hover) and (pointer: fine)'); }),
  ],
};

export default config;
