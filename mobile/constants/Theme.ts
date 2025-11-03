export const Theme = {
  colors: {
    primary: '#0B3D91',
    secondary: '#FF4D4F',
    background: '#F6F7FB',
    backgroundSecondary: '#FFFFFF',
    text: '#111827',
    textSecondary: '#6B7280',
    border: '#E5E7EB',
  },
  dark: {
    primary: '#3B82F6',
    secondary: '#FF6B6B',
    background: '#0B0C0E',
    backgroundSecondary: '#1A1B1E',
    text: '#F6F7FB',
    textSecondary: '#9CA3AF',
    border: '#374151',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
};

export type ThemeMode = 'light' | 'dark' | 'auto';
