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
    extend: {
      fontFamily: {
        sans: ['Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      fontSize: {
        'xxs': ['10px', { lineHeight: '14px' }],
        'micro': ['9px', { lineHeight: '12px' }],
        'nano': ['8px', { lineHeight: '10px' }],
      },
    },
  },
  plugins: [],
  safelist: [
    {
      pattern: /bg-(red|blue|green|yellow|purple|orange|indigo|amber|gray)-(50|100|200|500|600|700)/,
    },
    {
      pattern: /text-(red|blue|green|yellow|purple|orange|indigo|amber|gray|white|black)-(50|100|200|300|400|500|600|700|800|900)/,
    },
    {
      pattern: /border-(red|blue|green|yellow|purple|orange|indigo|amber|gray)-(50|100|200|300|400|500|600|700)/,
    },
  ],
}
