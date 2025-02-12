/**
 * @file Theme Configuration
 * @version 1.0.0
 * 
 * Core theme configuration implementing Material Design 3.0 with sports-specific
 * customizations. Defines comprehensive design tokens for colors, typography,
 * spacing, breakpoints and elevation system.
 */

// Types for theme configuration
interface ColorShade {
  main: string;
  light: string;
  dark: string;
  contrast: string;
}

interface SportsColors {
  performance: string;
  alert: string;
  recovery: string;
  intensity: string;
  teamPrimary: string;
  teamSecondary: string;
}

interface FeedbackColors {
  success: string;
  warning: string;
  error: string;
  info: string;
}

interface VisualizationColors {
  heatmap: string[];
  performance: string[];
  intensity: string[];
}

interface SurfaceColors {
  light: {
    background: string;
    paper: string;
    elevated: string;
  };
  dark: {
    background: string;
    paper: string;
    elevated: string;
  };
}

interface ColorPalette {
  primary: ColorShade;
  secondary: ColorShade;
  sports: SportsColors;
  feedback: FeedbackColors;
  visualization: VisualizationColors;
  surface: SurfaceColors;
}

interface FontFamily {
  primary: string;
  monospace: string;
  statistics: string;
}

interface FontSize {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  xxl: string;
  display: {
    sm: string;
    md: string;
    lg: string;
  };
  statistics: {
    sm: string;
    md: string;
    lg: string;
  };
}

interface FontWeight {
  light: number;
  regular: number;
  medium: number;
  bold: number;
  statistics: number;
}

interface LineHeight {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  statistics: number;
}

interface TypographySystem {
  fontFamily: FontFamily;
  fontSize: FontSize;
  fontWeight: FontWeight;
  lineHeight: LineHeight;
}

interface SpacingSystem {
  unit: string;
  base: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    xxl: string;
  };
  dashboard: {
    cardGap: string;
    sectionGap: string;
    containerPadding: string;
  };
  visualization: {
    chartPadding: string;
    legendGap: string;
    axisGap: string;
  };
}

interface BreakpointSystem {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
}

interface ElevationSystem {
  sm: string;
  md: string;
  lg: string;
  xl: string;
  visualization: {
    card: string;
    chart: string;
    tooltip: string;
  };
}

interface ThemeConfiguration {
  colors: ColorPalette;
  typography: TypographySystem;
  spacing: SpacingSystem;
  breakpoints: BreakpointSystem;
  shadows: ElevationSystem;
}

/**
 * Core theme configuration object implementing Material Design 3.0
 * with sports-specific customizations and visualizations support
 */
export const themeConfig: ThemeConfiguration = {
  colors: {
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
      contrast: '#ffffff'
    },
    secondary: {
      main: '#9c27b0',
      light: '#ba68c8',
      dark: '#7b1fa2',
      contrast: '#ffffff'
    },
    sports: {
      performance: '#00c853',
      alert: '#ff3d00',
      recovery: '#00b0ff',
      intensity: '#ff6d00',
      teamPrimary: '#variable',
      teamSecondary: '#variable'
    },
    feedback: {
      success: '#2e7d32',
      warning: '#ed6c02',
      error: '#d32f2f',
      info: '#0288d1'
    },
    visualization: {
      heatmap: [
        '#313695',
        '#4575b4',
        '#74add1',
        '#abd9e9',
        '#fee090',
        '#fdae61',
        '#f46d43',
        '#d73027'
      ],
      performance: [
        '#00c853',
        '#64dd17',
        '#aeea00',
        '#ffd600',
        '#ffab00',
        '#ff6d00',
        '#ff3d00'
      ],
      intensity: [
        '#e3f2fd',
        '#90caf9',
        '#42a5f5',
        '#1e88e5',
        '#1565c0',
        '#0d47a1'
      ]
    },
    surface: {
      light: {
        background: '#ffffff',
        paper: '#f5f5f5',
        elevated: '#ffffff'
      },
      dark: {
        background: '#121212',
        paper: '#1e1e1e',
        elevated: '#2c2c2c'
      }
    }
  },
  typography: {
    fontFamily: {
      primary: '"Roboto", "Helvetica", "Arial", sans-serif',
      monospace: '"Roboto Mono", monospace',
      statistics: '"Roboto Condensed", sans-serif'
    },
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      xxl: '1.5rem',
      display: {
        sm: '2rem',
        md: '2.5rem',
        lg: '3rem'
      },
      statistics: {
        sm: '1.25rem',
        md: '1.5rem',
        lg: '2rem'
      }
    },
    fontWeight: {
      light: 300,
      regular: 400,
      medium: 500,
      bold: 700,
      statistics: 600
    },
    lineHeight: {
      xs: 1.2,
      sm: 1.4,
      md: 1.6,
      lg: 1.8,
      statistics: 1.3
    }
  },
  spacing: {
    unit: '8px',
    base: {
      xs: '0.25rem',
      sm: '0.5rem',
      md: '1rem',
      lg: '1.5rem',
      xl: '2rem',
      xxl: '3rem'
    },
    dashboard: {
      cardGap: '1rem',
      sectionGap: '2rem',
      containerPadding: '1.5rem'
    },
    visualization: {
      chartPadding: '1.25rem',
      legendGap: '0.75rem',
      axisGap: '1rem'
    }
  },
  breakpoints: {
    xs: '320px',
    sm: '768px',
    md: '1024px',
    lg: '1440px',
    xl: '1920px'
  },
  shadows: {
    sm: '0 2px 4px rgba(0,0,0,0.1)',
    md: '0 4px 8px rgba(0,0,0,0.12)',
    lg: '0 8px 16px rgba(0,0,0,0.14)',
    xl: '0 12px 24px rgba(0,0,0,0.16)',
    visualization: {
      card: '0 8px 16px rgba(0,0,0,0.08)',
      chart: '0 12px 20px rgba(0,0,0,0.12)',
      tooltip: '0 4px 6px rgba(0,0,0,0.16)'
    }
  }
};