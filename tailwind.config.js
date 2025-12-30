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
    extend: {},
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
