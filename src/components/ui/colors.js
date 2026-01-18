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

  // Dark mode surfaces - Premium Deep Garden (stone-based for depth)
  charcoal: {
    50: '#FAFAF9',
    100: '#F5F5F4',
    200: '#E7E5E4',
    300: '#D6D3D1',
    400: '#A8A29E',
    500: '#78716C',
    600: '#57534E',
    700: '#44403C',
    800: '#292524',
    850: '#1F1E1D',
    900: '#1C1917', // Sheet background (slightly lighter than app bg)
    950: '#0C0A09', // App background (deepest layer - stone-950)
  },

  // Dark mode specific surface colors - Premium Deep Garden
  // Depth hierarchy: background → surface → elevated → highlight
  darkSurface: {
    background: '#050a08', // Level 0 - Deep forest black with green undertone
    surface: '#121413', // Level 1 - Sheet/overlay (visible above background)
    card: '#181a19', // Level 2 - Cards sitting on surface
    cardHighlight: '#1e201f', // Level 3 - Elevated/highlighted cards
    border: 'rgba(255, 255, 255, 0.10)', // Subtle glass borders
    inputBg: 'rgba(255, 255, 255, 0.08)', // Glass input background
    inputBorder: 'rgba(255, 255, 255, 0.12)', // Glass input border
    // Primary container - semi-transparent green for badges/active states
    primaryContainer: 'rgba(22, 163, 74, 0.18)', // #16A34A at 18% opacity
    onPrimaryContainer: '#86EFAC', // Light mint green text (primary-300)
    // Glass pill tab bar
    glassPill: 'rgba(28, 25, 23, 0.70)', // Frosted glass overlay
    glassCapsule: 'rgba(255, 255, 255, 0.22)', // Active tab capsule - prominent glass
  },

  // Light mode glass surfaces
  lightSurface: {
    glassPill: 'rgba(255, 255, 255, 0.85)', // Frosted glass overlay
    glassCapsule: 'rgba(0, 0, 0, 0.08)', // Active tab capsule
  },

  // Sheet colors for bottom sheets and modals
  sheet: {
    DEFAULT: '#FFFFFF', // Light mode sheet background
    handle: '#E6F4ED', // Light mode handle (neutral-100)
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
    950: '#022C22', // Darkest success for dark mode backgrounds
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
    950: '#451A03', // Darkest warning for dark mode backgrounds
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
