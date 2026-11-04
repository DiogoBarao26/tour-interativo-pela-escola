/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        card: '0 18px 50px -28px rgba(16, 50, 46, 0.45)',
      },
    },
  },
  plugins: [],
};
