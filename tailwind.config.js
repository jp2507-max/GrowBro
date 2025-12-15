const colors = require('./src/components/ui/colors');

/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        inter: ['Inter'],
      },
      colors: {
        ...colors,
        // Semantic color utilities (reference CSS variables in global.css)
        background: 'var(--color-background)',
        card: 'var(--color-card)',
        border: 'var(--color-border)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-inverse': 'var(--color-text-inverse)',
        'action-primary': 'var(--color-action-primary)',
        'action-primary-hover': 'var(--color-action-primary-hover)',
        'action-cta': 'var(--color-action-cta)',
        'action-cta-hover': 'var(--color-action-cta-hover)',
        'focus-ring': 'var(--color-focus-ring)',
      },
    },
  },
  plugins: [],
};
