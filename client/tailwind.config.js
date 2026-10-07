/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          yellow: '#FFD400',
          'yellow-hover': '#ECC500',
          'yellow-light': '#FFF9D6',
          blue: '#0B4DA2',
          'blue-hover': '#093E82',
          'blue-light': '#EBF3FC',
        },
        surface: {
          light: '#F8FAFC',
          dark: '#0F172A',
          card: '#FFFFFF',
          'card-dark': '#1E293B',
        },
      },
      fontFamily: {
        sans: ['Hind Siliguri', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 2px 10px rgba(0, 0, 0, 0.05)',
        elevated: '0 8px 30px rgba(0, 0, 0, 0.12)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
};
