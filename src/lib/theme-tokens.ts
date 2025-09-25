import colors from '@/components/ui/colors';

type Mode = 'light' | 'dark';

type SurfaceRole = {
  background: string;
  card: string;
  border: string;
};

type TextRole = {
  primary: string;
  secondary: string;
  inverse: string;
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

type ThemeRoles = {
  surface: Record<Mode, SurfaceRole>;
  text: Record<Mode, TextRole>;
  action: {
    primary: ActionRole;
    cta: ActionRole;
    link: LinkRole;
    focusRing: Record<Mode, string>;
  };
};

export const themeRoles: ThemeRoles = {
  surface: {
    light: {
      background: colors.neutral[100],
      card: colors.neutral[50],
      border: colors.neutral[400],
    },
    dark: {
      background: colors.charcoal[950],
      card: colors.charcoal[850],
      border: colors.charcoal[700],
    },
  },
  text: {
    light: {
      primary: colors.ink[800],
      secondary: colors.ink[700],
      inverse: colors.white,
    },
    dark: {
      primary: colors.charcoal[100],
      secondary: colors.charcoal[400],
      inverse: colors.charcoal[950],
    },
  },
  action: {
    primary: {
      background: {
        light: colors.primary[600],
        dark: colors.primary[300],
      },
      hover: {
        light: colors.primary[700],
        dark: colors.primary[400],
      },
      content: {
        light: colors.white,
        dark: colors.charcoal[950],
      },
    },
    cta: {
      background: {
        light: colors.terracotta[500],
        dark: colors.terracotta[400],
      },
      hover: {
        light: colors.terracotta[600],
        dark: colors.terracotta[500],
      },
      content: {
        light: colors.white,
        dark: colors.white,
      },
    },
    link: {
      color: {
        light: colors.sky[600],
        dark: colors.sky[300],
      },
      hover: {
        light: colors.sky[700],
        dark: colors.sky[400],
      },
    },
    focusRing: {
      light: colors.sky[400],
      dark: colors.sky[300],
    },
  },
};
