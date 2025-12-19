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
        // Semantic color utilities (reference CSS variables in nativewind-theme-provider.tsx)
        background: 'var(--color-background)',
        card: 'var(--color-card)',
        'card-highlight': 'var(--color-card-highlight)',
        border: 'var(--color-border)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-tertiary': 'var(--color-text-tertiary)',
        'text-inverse': 'var(--color-text-inverse)',
        'text-brand': 'var(--color-text-brand)',
        'action-primary': 'var(--color-action-primary)',
        'action-primary-hover': 'var(--color-action-primary-hover)',
        'action-cta': 'var(--color-action-cta)',
        'action-cta-text': 'var(--color-action-cta-text)',
        'action-cta-hover': 'var(--color-action-cta-hover)',
        'focus-ring': 'var(--color-focus-ring)',
        'status-success-bg': 'var(--color-status-success-bg)',
        'status-success-text': 'var(--color-status-success-text)',
        // Selection tokens (modal options)
        'selection-bg': 'var(--color-selection-bg)',
        'selection-border': 'var(--color-selection-border)',
        'selection-text': 'var(--color-selection-text)',
        'selection-check': 'var(--color-selection-check)',
      },
      borderRadius: {
        sheet: '40px',
      },
      spacing: {
        hero: '350px',
      },
    },
  },
  plugins: [],
};
