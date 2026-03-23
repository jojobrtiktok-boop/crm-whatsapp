/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        dark: {
          base: '#060b18',
          surface: '#0d1526',
          card: '#0f1a2e',
          border: '#1a2d4a',
          hover: '#162035',
        },
      },
      boxShadow: {
        glow: '0 0 20px rgba(99, 102, 241, 0.35)',
        'glow-blue': '0 0 25px rgba(59, 130, 246, 0.4)',
        'glow-sm': '0 0 10px rgba(99, 102, 241, 0.2)',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
        'gradient-primary-hover': 'linear-gradient(135deg, #2563eb, #7c3aed)',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
