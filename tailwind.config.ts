import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0B0B0A',
        surface: '#16140F',
        surface2: '#1D1A13',
        ivory: '#EFE8DA',
        muted: '#A69C89',
        brass: '#B08D57',
        brassLight: '#D9BD8E',
        burgundy: '#6E2A2A',
        hairline: '#2E2A22',
      },
      fontFamily: {
        display: ['var(--font-fraunces)', 'serif'],
        body: ['var(--font-inter)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      borderRadius: {
        tag: '4px',
      },
    },
  },
  plugins: [],
};

export default config;
