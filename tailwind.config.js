// tailwind.config.js
const colors = require('tailwindcss/colors') // If you want to use default colors

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Optional: Define custom brand colors inspired by MiraclePlus
      colors: {
        primary: { // Example using Tailwind's indigo
          light: colors.indigo[50],
          DEFAULT: colors.indigo[600],
          dark: colors.indigo[700],
          text: colors.indigo[100], // For text on dark primary bg
          border: colors.indigo[200],
          ring: colors.indigo[500],
        },
        // You could define specific hex codes if you identify them
        // miracleBlue: '#abcdef',
      }
    },
  },
  plugins: [
     require('@tailwindcss/forms'), // Optional: improves form styling
  ],
}