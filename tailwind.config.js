/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary": "#1165d4ff",
        "background-light": "#f6f8f6",
        "background-dark": "#152210",
        "earthy-navy": "#111b0d",
        "olive-drab": "#203f77ff",
      },
      fontFamily: {
        "display": ["Space Grotesk", "sans-serif"],
        "sans": ["Space Grotesk", "sans-serif"],
      },
    },
  },
  plugins: [],
}