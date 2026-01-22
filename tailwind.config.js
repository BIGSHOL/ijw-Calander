/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./utils/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
  ],
  theme: {
    // Responsive Breakpoints - 명시적 정의
    screens: {
      'sm': '640px',   // 모바일 가로/작은 태블릿
      'md': '768px',   // 태블릿
      'lg': '1024px',  // 데스크톱
      'xl': '1280px',  // 큰 데스크톱
    },
    extend: {
      // Brand Colors - Addresses Issue #9
      colors: {
        primary: {
          DEFAULT: '#081429',
          50: '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          300: '#9fb3c8',
          400: '#829ab1',
          500: '#627d98',
          600: '#486581',
          700: '#334e68',
          800: '#243b53',
          900: '#102a43',
        },
        accent: {
          DEFAULT: '#fdb813',
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#fdb813',
          600: '#e5a60f',
          700: '#c7910c',
          800: '#a67c0a',
          900: '#8b6507',
        },
        success: {
          light: '#d1fae5',
          DEFAULT: '#10b981',
          dark: '#065f46',
        },
        error: {
          light: '#fee2e2',
          DEFAULT: '#ef4444',
          dark: '#991b1b',
        },
        warning: {
          light: '#fef3c7',
          DEFAULT: '#f59e0b',
          dark: '#92400e',
        },
        info: {
          light: '#dbeafe',
          DEFAULT: '#3b82f6',
          dark: '#1e40af',
        },
      },
      // Typography Scale - Keep existing sizes for compact UI
      fontFamily: {
        sans: ['Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'Monaco', 'monospace'],
      },
      fontSize: {
        'xxs': ['10px', { lineHeight: '14px' }],
        'micro': ['9px', { lineHeight: '12px' }],
        'nano': ['8px', { lineHeight: '10px' }],
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
      },
      // Spacing - Addresses Issue #19
      spacing: {
        '0': '0',
        'px': '1px',
        '0.5': '0.125rem',
        '1': '0.25rem',
        '1.5': '0.375rem',
        '2': '0.5rem',
        '2.5': '0.625rem',
        '3': '0.75rem',
        '3.5': '0.875rem',
        '4': '1rem',
        '5': '1.25rem',
        '6': '1.5rem',
        '7': '1.75rem',
        '8': '2rem',
        '9': '2.25rem',
        '10': '2.5rem',
        '11': '2.75rem', // 44px - minimum touch target
        '12': '3rem',
        '14': '3.5rem',
        '16': '4rem',
        '20': '5rem',
        '24': '6rem',
        '32': '8rem',
      },
      // Border Radius
      borderRadius: {
        'none': '0',
        'sm': '0.25rem',
        DEFAULT: '0.5rem',
        'md': '0.75rem',
        'lg': '1rem',
        'xl': '1.5rem',
        '2xl': '2rem',
        'full': '9999px',
      },
      // Box Shadow
      boxShadow: {
        'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        'inner': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
        'none': 'none',
      },
    },
  },
  plugins: [
    require('@tailwindcss/container-queries'),
  ],
  safelist: [
    {
      pattern: /bg-(red|blue|green|yellow|purple|orange|indigo|amber|gray|primary|accent|success|error|warning|info)-(50|100|200|500|600|700)/,
    },
    {
      pattern: /text-(red|blue|green|yellow|purple|orange|indigo|amber|gray|white|black|primary|accent|success|error|warning|info)-(50|100|200|300|400|500|600|700|800|900)/,
    },
    {
      pattern: /border-(red|blue|green|yellow|purple|orange|indigo|amber|gray|primary|accent|success|error|warning|info)-(50|100|200|300|400|500|600|700)/,
    },
  ],
}
