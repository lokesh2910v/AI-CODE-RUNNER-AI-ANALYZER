/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
  safelist: [
    'bg-green-500',
    'bg-red-500',
    'ring-green-400',
    'ring-red-400',
    'text-green-500',
    'text-red-500',
    'animate-spin'
  ]
};

