import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Bebas Neue', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
        data: ['Space Mono', 'monospace'],
      },
      colors: {
        // Map CSS custom properties as Tailwind colors (for reference only)
        // Components should use CSS custom properties directly
      },
    },
  },
  plugins: [],
};

export default config;






















