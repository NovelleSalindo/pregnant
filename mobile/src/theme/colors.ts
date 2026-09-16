// PregnaCare Design Tokens — 1:1 Match with web css/style.css
// Reference Pastel Palette: #CDB4DB, #FFC8DD, #FFAFCC, #BDE0FE, #A2D2FF

export const Colors = {
  // Primary Pink Accent (--teal in style.css)
  primary: '#FFAFCC',        // hot pink — primary accent
  primaryDark: '#C2577D',    // deepened pink, for text/hover on white
  primaryLight: '#FFC8DD',   // light pink
  primaryMuted: '#FFDFEC',

  // Secondary Blue Accent (--sky in style.css)
  secondary: '#A2D2FF',      // blue — secondary accent
  secondaryDark: '#3E7CC4',
  secondaryLight: '#BDE0FE',
  secondarySoft: '#E8F5FB',

  // Tertiary Lavender Accent (--green in style.css)
  lavender: '#CDB4DB',      // purple — tertiary accent
  lavenderLight: '#F1E7F5',

  // Clinical Risk Levels (semantic medical colors from style.css)
  riskLow: '#6FAE82',
  riskLowBg: '#E7F4EB',
  riskMod: '#E0A24A',
  riskModBg: '#FCF1DD',
  riskHigh: '#E15D74',
  riskHighBg: '#FCE4E9',

  // Backgrounds & Surfaces
  background: '#FAF7FC',     // --bg
  backgroundSoft: '#F2E9F5', // --bg-soft
  surface: '#FFFFFF',        // --surface
  surfaceGlass: 'rgba(255, 255, 255, 0.85)',
  border: '#EADFF0',         // --border
  borderSoft: '#F5EFF9',

  // Typography Colors
  text: '#2B2229',           // --ink
  textSoft: '#6B5C63',       // --ink-soft
  textMuted: '#A79AA0',      // --muted
  white: '#FFFFFF',

  // Backward-compatibility aliases for components
  accent: '#C2577D',
  accentLight: '#FFC8DD',
  riskSevere: '#E15D74',
  riskSevereLight: '#FCE4E9',
  riskLowLight: '#E7F4EB',
  surfaceSoft: '#F2E9F5',
  borderLight: '#F5EFF9',
  textLight: '#A79AA0',
};

export const Gradients = {
  hero: ['#FFAFCC', '#A2D2FF'] as const,
  brandMark: ['#FFAFCC', '#A2D2FF'] as const,
  primaryBtn: ['#FFAFCC', '#C2577D'] as const,
  emergency: ['#E15D74', '#C43F58'] as const,
  lavenderPink: ['#CDB4DB', '#FFAFCC'] as const,
  skyBlue: ['#BDE0FE', '#A2D2FF'] as const,
};

export const Shadows = {
  soft: {
    shadowColor: '#2B2229',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  card: {
    shadowColor: '#2B2229',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  glow: {
    shadowColor: '#C2577D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  // Backward-compatibility aliases
  small: {
    shadowColor: '#2B2229',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  medium: {
    shadowColor: '#2B2229',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  large: {
    shadowColor: '#2B2229',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
  },
};
