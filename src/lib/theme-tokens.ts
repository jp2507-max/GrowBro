/**
 * Theme Tokens for JS/Native style props
 * Keep in sync with nativewind-theme-provider.tsx
 * Use for React Navigation, native `style` props, etc.
 */
import colors from '@/components/ui/colors';

type Mode = 'light' | 'dark';

type SurfaceRole = {
  background: string;
  card: string;
  cardHighlight: string;
  border: string;
};

type TextRole = {
  primary: string;
  secondary: string;
  tertiary: string;
  inverse: string;
  brand: string;
};

type ActionRole = {
  background: Record<Mode, string>;
  hover: Record<Mode, string>;
  content: Record<Mode, string>;
};

type LinkRole = {
  color: Record<Mode, string>;
  hover: Record<Mode, string>;
};

type StatusRole = {
  successBg: Record<Mode, string>;
  successText: Record<Mode, string>;
};

type SelectionRole = {
  background: Record<Mode, string>;
  border: Record<Mode, string>;
  text: Record<Mode, string>;
  check: Record<Mode, string>;
};

type ThemeRoles = {
  surface: Record<Mode, SurfaceRole>;
  text: Record<Mode, TextRole>;
  action: {
    primary: ActionRole;
    cta: ActionRole;
    link: LinkRole;
    focusRing: Record<Mode, string>;
  };
  status: StatusRole;
  selection: SelectionRole;
};

// Modern Organic Tech theme - clean, premium, crisp
export const themeRoles: ThemeRoles = {
  surface: {
    light: {
      background: colors.neutral[50], // #F2F9F6 - Morning Mist
      card: colors.white,
      cardHighlight: colors.primary[50],
      border: colors.neutral[200], // #CCEBD9 - sanftes Grün
    },
    dark: {
      background: '#050B09', // Deep forest black
      card: '#121C18', // Slightly lighter
      cardHighlight: '#1A2622',
      border: '#23332D', // Defined edges for premium depth
    },
  },
  text: {
    light: {
      primary: '#022C22', // Deep Jungle - fast schwarz aber warm
      secondary: colors.neutral[600], // #376558 - Waldgrün
      tertiary: colors.neutral[500], // #4A8A6B
      inverse: colors.white,
      brand: colors.primary[700],
    },
    dark: {
      primary: '#F0FDF4', // Cool mint-white
      secondary: '#94A3B8', // Good readability
      tertiary: '#475569',
      inverse: '#050B09',
      brand: colors.primary[400],
    },
  },
  action: {
    primary: {
      background: {
        light: colors.primary[600],
        dark: colors.primary[500], // Brighter for glow effect
      },
      hover: {
        light: colors.primary[700],
        dark: colors.primary[600],
      },
      content: {
        light: colors.white,
        dark: '#050B09',
      },
    },
    cta: {
      background: {
        light: colors.terracotta[500], // Strong guidance color
        dark: colors.terracotta[500], // Pops on dark
      },
      hover: {
        light: colors.terracotta[600],
        dark: colors.terracotta[600],
      },
      content: {
        light: colors.white,
        dark: colors.white,
      },
    },
    link: {
      color: {
        light: colors.primary[600],
        dark: colors.primary[300],
      },
      hover: {
        light: colors.primary[700],
        dark: colors.primary[400],
      },
    },
    focusRing: {
      light: colors.primary[400],
      dark: colors.primary[300],
    },
  },
  status: {
    successBg: {
      light: colors.primary[100],
      dark: 'rgba(16, 185, 129, 0.15)', // Modern glassy look
    },
    successText: {
      light: colors.primary[800],
      dark: colors.primary[300],
    },
  },
  selection: {
    background: {
      light: colors.primary[50],
      dark: 'rgba(16, 185, 129, 0.12)', // Glassy primary
    },
    border: {
      light: colors.primary[100],
      dark: 'rgba(16, 185, 129, 0.25)',
    },
    text: {
      light: colors.primary[900],
      dark: colors.primary[200],
    },
    check: {
      light: colors.primary[600],
      dark: colors.primary[400],
    },
  },
};
