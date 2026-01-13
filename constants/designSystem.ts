/**
 * Unified Design System for InjaeWon Calendar Application
 * Addresses issues: #9, #19, #24, #25, #34, #52
 */

export const colors = {
  primary: {
    DEFAULT: '#081429',
    50: '#f0f4f8',
    100: '#d9e2ec',
    600: '#486581',
    900: '#102a43',
  },
  accent: {
    DEFAULT: '#fdb813',
    600: '#e5a60f',
  },
  success: {
    DEFAULT: '#10b981',
    light: '#d1fae5',
    dark: '#065f46',
  },
  error: {
    DEFAULT: '#ef4444',
    light: '#fee2e2',
    dark: '#991b1b',
  },
  warning: {
    DEFAULT: '#f59e0b',
  },
  info: {
    DEFAULT: '#3b82f6',
  },
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    500: '#6b7280',
    700: '#374151',
    900: '#111827',
  },
} as const;

export const spacing = {
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  6: '1.5rem',
  8: '2rem',
  11: '2.75rem', // 44px min touch target
} as const;

export const a11y = {
  focusRing: 'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2',
  skipLink: 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-accent focus:text-primary',
} as const;