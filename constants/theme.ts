/**
 * FaceGate Design System — Central Theme Tokens
 * Dark theme with deep navy background, electric blue accents,
 * glassmorphism cards, and biometric/security aesthetic.
 */

export const Colors = {
  // Core backgrounds
  background: '#0A0F1E',
  backgroundLight: '#0F1629',
  backgroundCard: 'rgba(255, 255, 255, 0.05)',
  backgroundCardHover: 'rgba(255, 255, 255, 0.08)',
  
  // Primary accent
  accent: '#00D4FF',
  accentDim: 'rgba(0, 212, 255, 0.15)',
  accentGlow: 'rgba(0, 212, 255, 0.3)',
  
  // Secondary accent (violet)
  secondary: '#7C5CFC',
  secondaryDim: 'rgba(124, 92, 252, 0.15)',
  secondaryGlow: 'rgba(124, 92, 252, 0.3)',
  
  // Status colors
  success: '#00FF88',
  successDim: 'rgba(0, 255, 136, 0.15)',
  successGlow: 'rgba(0, 255, 136, 0.3)',
  
  danger: '#FF3B5C',
  dangerDim: 'rgba(255, 59, 92, 0.15)',
  dangerGlow: 'rgba(255, 59, 92, 0.3)',
  
  warning: '#FFB800',
  warningDim: 'rgba(255, 184, 0, 0.15)',
  
  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#8B95A8',
  textTertiary: '#4A5568',
  textAccent: '#00D4FF',
  
  // Borders
  borderDefault: 'rgba(255, 255, 255, 0.08)',
  borderAccent: 'rgba(0, 212, 255, 0.2)',
  borderSuccess: 'rgba(0, 255, 136, 0.2)',
  borderDanger: 'rgba(255, 59, 92, 0.2)',
  borderSecondary: 'rgba(124, 92, 252, 0.2)',
  
  // Glassmorphism
  glassBg: 'rgba(15, 22, 41, 0.7)',
  glassBorder: 'rgba(255, 255, 255, 0.1)',
  
  // Tab bar
  tabBarBg: 'rgba(10, 15, 30, 0.95)',
  tabActive: '#00D4FF',
  tabInactive: '#4A5568',
  
  // Shimmer
  shimmerBase: 'rgba(255, 255, 255, 0.05)',
  shimmerHighlight: 'rgba(255, 255, 255, 0.12)',
  
  // Overlay
  overlay: 'rgba(0, 0, 0, 0.6)',
  overlayLight: 'rgba(0, 0, 0, 0.4)',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
} as const;

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
} as const;

export const Typography = {
  heading: {
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  headingMedium: {
    fontFamily: 'SpaceGrotesk_500Medium',
  },
  body: {
    fontFamily: 'Inter_400Regular',
  },
  bodyMedium: {
    fontFamily: 'Inter_500Medium',
  },
  bodySemiBold: {
    fontFamily: 'Inter_600SemiBold',
  },
} as const;

export const FontSizes = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 48,
} as const;

export const Shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  }),
  cardGlow: {
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
} as const;

export const GlassStyles = {
  card: {
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: BorderRadius.lg,
  },
  cardAccent: {
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    borderRadius: BorderRadius.lg,
  },
} as const;
