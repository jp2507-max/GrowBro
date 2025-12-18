// colors.js - Modern Organic Tech palette
// Slate neutrals for clean, premium look
// Terracotta for strong CTA guidance
module.exports = {
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',

  // Organic Neutrals - Morning Mist Green
  // Warme, lebendige Töne statt kaltem Slate
  neutral: {
    50: '#F2F9F6', // Morning Mist - helles Minz-Weiß (Background Light)
    100: '#E6F4ED', // Card Background Hover - sanftes Grün
    200: '#CCEBD9', // Borders Light - sichtbar aber soft
    300: '#A8D9C0', // Icons inaktiv
    400: '#6EAD8C', // Text Tertiary
    500: '#4A8A6B', // Text Secondary
    600: '#376558', // Mid forest
    700: '#264A3D', // Dark forest
    800: '#142820', // Card Background Dark - tiefes Waldgrün
    900: '#0A1612', // App Background Dark - Deep Forest
    950: '#050B09', // Deepest Dark
  },

  // Dark mode surfaces - deep forest greens (kept for backward compat)
  charcoal: {
    50: '#F0FDF4',
    100: '#D1FAE5',
    200: '#A7F3D0',
    300: '#6EE7B7',
    400: '#34D399',
    500: '#10B981',
    600: '#059669',
    700: '#047857',
    800: '#1A2E25',
    850: '#142620',
    900: '#0F1F1A',
    950: '#0A1512',
  },

  // Primary: "Deep Jungle"
  // Etwas satter und weniger "neon" als vorher
  primary: {
    50: '#ECFDF5',
    100: '#D1FAE5',
    200: '#A7F3D0',
    300: '#6EE7B7',
    400: '#34D399',
    500: '#10B981', // Main Brand Color
    600: '#059669',
    700: '#047857',
    800: '#065F46',
    900: '#064E3B',
    950: '#022C22', // Sehr dunkler Akzent für Dark Mode
  },

  // Secondary - warm amber for accents
  sky: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    200: '#FDE68A',
    300: '#FCD34D',
    400: '#FBBF24',
    500: '#F59E0B',
    600: '#D97706',
    700: '#B45309',
    800: '#92400E',
    900: '#78350F',
  },

  // Action / CTA: "Burnt Clay"
  // Das ist deine wichtigste Farbe für die User-Führung!
  terracotta: {
    50: '#FFF7ED',
    100: '#FFEDD5',
    200: '#FED7AA',
    300: '#FDBA74',
    400: '#FB923C',
    500: '#F97316', // Primary Button Color
    600: '#EA580C', // Button Hover
    700: '#C2410C',
    800: '#9A3412',
    900: '#7C2D12',
  },

  // Text colors - kept for backward compat
  ink: {
    50: '#F0FDF4',
    100: '#DCFCE7',
    200: '#BBF7D0',
    300: '#86EFAC',
    400: '#4ADE80',
    500: '#22C55E',
    600: '#16A34A',
    700: '#15803D',
    800: '#166534',
    900: '#14532D',
  },

  // Semantic Colors
  success: {
    50: '#ECFDF5',
    100: '#D1FAE5',
    200: '#A7F3D0',
    300: '#6EE7B7',
    400: '#34D399',
    500: '#10B981', // Gleich wie Primary 500
    600: '#059669',
    700: '#047857',
    800: '#065F46',
    900: '#064E3B',
  },

  warning: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    200: '#FDE68A',
    300: '#FCD34D',
    400: '#FBBF24',
    500: '#F59E0B',
    600: '#D97706',
    700: '#B45309',
    800: '#92400E',
    900: '#78350F',
  },

  danger: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    200: '#FECACA',
    300: '#FCA5A5',
    400: '#F87171',
    500: '#EF4444',
    600: '#DC2626',
    700: '#B91C1C',
    800: '#991B1B',
    900: '#7F1D1D',
  },

  indigo: {
    50: '#EEF2FF',
    100: '#E0E7FF',
    200: '#C7D2FE',
    300: '#A5B4FC',
    400: '#818CF8',
    500: '#6366F1',
    600: '#4F46E5',
    700: '#4338CA',
    800: '#3730A3',
    900: '#312E81',
    950: '#1E1B4B',
  },

  // Semantic shorthand (for quick access)
  info: '#3B82F6',
};
