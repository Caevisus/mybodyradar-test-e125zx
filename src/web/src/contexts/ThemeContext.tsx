import React, { createContext, useContext, useCallback, useEffect, useState, useMemo } from 'react';
import { themeConfig } from '../config/theme.config';

// Theme mode type definition
type ThemeMode = 'light' | 'dark' | 'system';

// Interface for team colors
interface TeamColors {
  primary: string;
  secondary: string;
  accent: string;
}

// Interface for theme state
interface ThemeState {
  mode: ThemeMode;
  teamColors: TeamColors;
  typography: typeof themeConfig.typography;
  spacing: typeof themeConfig.spacing;
  breakpoints: typeof themeConfig.breakpoints;
  shadows: typeof themeConfig.shadows;
  colors: typeof themeConfig.colors;
}

// Interface for theme context value
interface ThemeContextValue {
  theme: ThemeState;
  toggleTheme: () => void;
  setTeamColors: (colors: TeamColors) => void;
}

// Create theme context
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// Local storage keys
const THEME_MODE_KEY = 'smart-apparel-theme-mode';
const TEAM_COLORS_KEY = 'smart-apparel-team-colors';

// Default team colors
const defaultTeamColors: TeamColors = {
  primary: themeConfig.colors.primary.main,
  secondary: themeConfig.colors.secondary.main,
  accent: themeConfig.colors.sports.performance
};

/**
 * Custom hook for detecting system theme preference
 * @returns Current system theme preference
 */
const useSystemTheme = (): 'light' | 'dark' => {
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() => 
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return systemTheme;
};

/**
 * Theme Provider Component
 * Manages application-wide theme state with system theme detection and persistence
 */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemTheme = useSystemTheme();
  
  // Initialize theme state from local storage or defaults
  const [themeState, setThemeState] = useState<ThemeState>(() => {
    const savedMode = localStorage.getItem(THEME_MODE_KEY) as ThemeMode || 'system';
    const savedTeamColors = JSON.parse(localStorage.getItem(TEAM_COLORS_KEY) || 'null') || defaultTeamColors;

    return {
      mode: savedMode,
      teamColors: savedTeamColors,
      typography: themeConfig.typography,
      spacing: themeConfig.spacing,
      breakpoints: themeConfig.breakpoints,
      shadows: themeConfig.shadows,
      colors: {
        ...themeConfig.colors,
        sports: {
          ...themeConfig.colors.sports,
          teamPrimary: savedTeamColors.primary,
          teamSecondary: savedTeamColors.secondary
        }
      }
    };
  });

  // Memoized theme toggle function
  const toggleTheme = useCallback(() => {
    setThemeState(prev => {
      const newMode: ThemeMode = prev.mode === 'light' ? 'dark' : 
                                prev.mode === 'dark' ? 'system' : 'light';
      localStorage.setItem(THEME_MODE_KEY, newMode);
      return { ...prev, mode: newMode };
    });
  }, []);

  // Memoized team colors setter with validation
  const setTeamColors = useCallback((colors: TeamColors) => {
    // Validate color values
    const isValidColor = (color: string) => /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
    
    if (!isValidColor(colors.primary) || !isValidColor(colors.secondary) || !isValidColor(colors.accent)) {
      throw new Error('Invalid color format. Colors must be valid hex values.');
    }

    setThemeState(prev => {
      const newColors = {
        ...prev.colors,
        sports: {
          ...prev.colors.sports,
          teamPrimary: colors.primary,
          teamSecondary: colors.secondary
        }
      };
      
      localStorage.setItem(TEAM_COLORS_KEY, JSON.stringify(colors));
      return {
        ...prev,
        teamColors: colors,
        colors: newColors
      };
    });
  }, []);

  // Compute effective theme based on mode
  const effectiveTheme = useMemo(() => ({
    ...themeState,
    mode: themeState.mode === 'system' ? systemTheme : themeState.mode
  }), [themeState, systemTheme]);

  // Memoized context value
  const contextValue = useMemo(() => ({
    theme: effectiveTheme,
    toggleTheme,
    setTeamColors
  }), [effectiveTheme, toggleTheme, setTeamColors]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * Custom hook for accessing theme context
 * @returns Theme context value with memoized functions
 * @throws Error if used outside ThemeProvider
 */
export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  
  return context;
};