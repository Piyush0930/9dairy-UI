/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the files that use Tailwind classes
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        light: {
          background: '#FFFFFF',
          text: '#000000', 
          textSecondary: '#6B7280',
          accent: '#3B82F6',
          border: '#E5E7EB',
          white: '#FFFFFF',
        }
      },
    },
  },
  plugins: [],
}