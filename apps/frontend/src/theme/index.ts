import React, { createContext, useContext, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { rawTokens } from './tokens';

export * from './tokens';

export type ColorTheme = typeof rawTokens.color.light;

interface ThemeContextValue {
  colors: ColorTheme;
  isDark: boolean;
  typography: typeof rawTokens.typography;
  spacing: typeof rawTokens.spacing;
  spacingCollection: typeof rawTokens.spacingCollection;
  borderRadius: typeof rawTokens.borderRadius;
  elevation: typeof rawTokens.elevation;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<{ children: ReactNode; forcedTheme?: 'light' | 'dark' | 'system' }> = ({
  children,
  forcedTheme,
}) => {
  const systemScheme = useColorScheme();
  const effectiveTheme =
    forcedTheme === 'dark' || (forcedTheme !== 'light' && systemScheme === 'dark')
      ? 'dark'
      : 'light';

  const isDark = effectiveTheme === 'dark';
  const colors = isDark ? rawTokens.color.dark : rawTokens.color.light;

  const value: ThemeContextValue = {
    colors,
    isDark,
    typography: rawTokens.typography,
    spacing: rawTokens.spacing,
    spacingCollection: rawTokens.spacingCollection,
    borderRadius: rawTokens.borderRadius,
    elevation: rawTokens.elevation,
  };

  return React.createElement(ThemeContext.Provider, { value }, children);
};

/**
 * Hook to provide current effective theme colors based on system appearance.
 * Honors design-system-rule.md: dark mode is functional but flags unresolved magenta tokens.
 */
export function useTheme(forcedTheme?: 'light' | 'dark' | 'system'): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context && !forcedTheme) {
    return context;
  }

  const systemScheme = useColorScheme();
  const effectiveTheme =
    forcedTheme === 'dark' || (forcedTheme !== 'light' && systemScheme === 'dark')
      ? 'dark'
      : 'light';

  const isDark = effectiveTheme === 'dark';
  const colors = isDark ? rawTokens.color.dark : rawTokens.color.light;

  return {
    colors,
    isDark,
    typography: rawTokens.typography,
    spacing: rawTokens.spacing,
    spacingCollection: rawTokens.spacingCollection,
    borderRadius: rawTokens.borderRadius,
    elevation: rawTokens.elevation,
  };
}
