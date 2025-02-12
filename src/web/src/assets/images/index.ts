// Image Assets Index v1.0.0
// Implements Material Design 3.0 visual hierarchy and supports biomechanical visualization

// Heat Map Visualization Assets
export const heatMapGradient = '/assets/images/visualization/heatmap-gradient.png';

// Brand Assets
export const logo = {
  light: '/assets/images/brand/logo-light.svg',
  dark: '/assets/images/brand/logo-dark.svg',
  compact: '/assets/images/brand/logo-compact.svg'
};

// User Interface Assets
export const defaultAvatar = {
  small: '/assets/images/ui/avatar-sm.png',
  medium: '/assets/images/ui/avatar-md.png',
  large: '/assets/images/ui/avatar-lg.png'
};

// Sensor and Anatomical Reference Assets
export const sensorPlacementGuide = {
  front: '/assets/images/guides/sensor-placement-front.svg',
  back: '/assets/images/guides/sensor-placement-back.svg',
  calibration: '/assets/images/guides/sensor-calibration-markers.svg'
};

export const muscleGroupOverlay = {
  anterior: '/assets/images/anatomy/muscle-groups-anterior.svg',
  posterior: '/assets/images/anatomy/muscle-groups-posterior.svg',
  interactive: '/assets/images/anatomy/muscle-groups-interactive.svg'
};

// UI State Illustrations
export const loadingSpinner = {
  small: '/assets/images/states/loading-sm.svg',
  medium: '/assets/images/states/loading-md.svg',
  large: '/assets/images/states/loading-lg.svg'
};

export const errorIllustration = {
  network: '/assets/images/states/error-network.svg',
  permission: '/assets/images/states/error-permission.svg',
  general: '/assets/images/states/error-general.svg'
};

export const emptyStateIllustration = {
  noData: '/assets/images/states/empty-no-data.svg',
  noResults: '/assets/images/states/empty-no-results.svg',
  noActivity: '/assets/images/states/empty-no-activity.svg'
};

// Performance Visualization Assets
export const performanceGraphBackground = {
  light: '/assets/images/visualization/graph-bg-light.svg',
  dark: '/assets/images/visualization/graph-bg-dark.svg'
};

// Anatomical Reference Set
export const anatomicalReferenceSet = {
  skeleton: {
    anterior: '/assets/images/anatomy/skeleton-anterior.svg',
    posterior: '/assets/images/anatomy/skeleton-posterior.svg',
    lateral: '/assets/images/anatomy/skeleton-lateral.svg'
  },
  muscular: {
    anterior: '/assets/images/anatomy/muscular-anterior.svg',
    posterior: '/assets/images/anatomy/muscular-posterior.svg',
    lateral: '/assets/images/anatomy/muscular-lateral.svg'
  },
  kinematicChains: {
    lowerBody: '/assets/images/anatomy/kinematic-lower.svg',
    upperBody: '/assets/images/anatomy/kinematic-upper.svg',
    fullBody: '/assets/images/anatomy/kinematic-full.svg'
  }
};

// Resolution-specific image sets for high-DPI displays
export const hiDpiAssets = {
  heatMapGradient: '/assets/images/visualization/heatmap-gradient@2x.png',
  logo: {
    light: '/assets/images/brand/logo-light@2x.svg',
    dark: '/assets/images/brand/logo-dark@2x.svg'
  }
};

// Ensure all images are pre-loadable for optimal performance
export const preloadableAssets = [
  heatMapGradient,
  logo.light,
  logo.dark,
  defaultAvatar.medium,
  sensorPlacementGuide.front,
  muscleGroupOverlay.anterior,
  loadingSpinner.medium,
  errorIllustration.general,
  emptyStateIllustration.noData,
  performanceGraphBackground.light,
  anatomicalReferenceSet.skeleton.anterior
];