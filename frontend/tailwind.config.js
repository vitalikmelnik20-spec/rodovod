/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: { bg: '#0F172A', card: '#1E293B', accent: '#3B82F6' },
        light: { bg: '#F8FAFC', card: '#FFFFFF', accent: '#1E40AF' },
      },
    },
  },
  plugins: [],
};
