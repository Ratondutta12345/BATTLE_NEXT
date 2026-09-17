import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#000000',
    backgroundSelected: '#000000',
    textSecondary: '#ffffff',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#000000',
    backgroundSelected: '#000000',
    textSecondary: '#ffffff',
  },
} as const;

export const AppHeaderColors = {
  background: '#0B1628',
  title: '#FFFFFF',
  subtitle: '#B8C5D9',
  icon: '#FFFFFF',
  logoBackground: '#132238',
  logoBorder: 'rgba(255, 255, 255, 0.12)',
  coinPillBackground: '#FFFFFF',
  coinText: '#0B1628',
  coinIcon: '#F5A623',
  badge: '#E53935',
} as const;

export const AuthColors = {
  background: '#FFFFFF',
  text: '#1A1A1A',
  textSecondary: '#666666',
  placeholder: '#AAAAAA',
  primary: '#F7941D',
  primaryDark: '#E8850F',
  applyButton: '#FFB800',
  border: '#E8E8E8',
  inputBackground: '#FFFFFF',
  error: '#E53935',
  link: '#F7941D',
  divider: '#CCCCCC',
  shadow: '#000000',
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export function scale(n: number) {
  return n;
}

export const AuthSpacing = {
  screenHorizontal: 28,
  fieldGap: 14,
  sectionGap: 24,
  headingGap: 4,
} as const;

export const AuthSizes = {
  inputHeight: 54,
  buttonHeight: 54,
  inputRadius: 28,
  buttonRadius: 28,
  googleButtonSize: 56,
  headingLarge: 34,
  headingSmall: 18,
  body: 15,
  label: 14,
  link: 15,
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
