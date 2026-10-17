/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          dark: '#080F1B',
          sidebar: '#0B1422',
          panel: '#111C2B',
          card: '#0D1726',
          cardInner: '#152233',
          hover: '#172437',
        },
        border: {
          DEFAULT: '#243449',
          subtle: '#1A293D',
          highlight: '#354B66',
        },
        cyan: {
          DEFAULT: '#31D7E8',
          hover: '#26BCD0',
          dark: '#0E2A3B',
          glow: 'rgba(49, 215, 232, 0.15)',
        },
        success: {
          DEFAULT: '#39D9A5',
          dark: '#0E2F26',
        },
        warning: {
          DEFAULT: '#F4B84A',
          dark: '#2E2413',
        },
        danger: {
          DEFAULT: '#FF647C',
          dark: '#33161F',
        },
        text: {
          primary: '#E6EDF7',
          secondary: '#8192A9',
          muted: '#4F6179',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '0.85rem' }],
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.8125rem', { lineHeight: '1.2rem' }],
        'base': ['0.875rem', { lineHeight: '1.35rem' }],
      }
    },
  },
  plugins: [],
}
