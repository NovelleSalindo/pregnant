// PregnaCare Design Tokens & Color Palette
export const Colors = {
  primary: '#0E9C8F',
  primaryDark: '#0B7A70',
  primaryLight: '#E6F6F4',
  primaryMuted: '#A7DDD7',
  
  secondary: '#38A3D6',
  secondaryLight: '#E8F5FB',
  
  accent: '#F26D6D',
  accentLight: '#FDECEC',
  
  // Risk Tier Colors
  riskLow: '#10B981',      // Emerald Green
  riskLowLight: '#D1FAE5',
  riskHigh: '#F59E0B',     // Amber / Warm Yellow
  riskHighLight: '#FEF3C7',
  riskSevere: '#EF4444',   // Crimson Red
  riskSevereLight: '#FEE2E2',

  // Neutrals & Surfaces
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceSoft: '#F1F5F9',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  
  text: '#0F172A',
  textMuted: '#64748B',
  textLight: '#94A3B8',
  white: '#FFFFFF',
  shadow: '#0F172A',
};

export const Shadows = {
  small: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  large: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
};
