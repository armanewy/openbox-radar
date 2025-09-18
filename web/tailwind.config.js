module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      screens: {
        '2xl': '80rem',
      },
    },
    extend: {
      colors: {
        brand: {
          DEFAULT: '#00e676',
          50: '#e6fff2',
          100: '#c2ffe0',
          200: '#8cffc6',
          300: '#4dffa6',
          400: '#1aff8e',
          500: '#00e676',
          600: '#00c26a',
          700: '#00a05c',
          800: '#047d4b',
          900: '#075f3d',
        },
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
      },
      boxShadow: {
        card: '0 6px 20px rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
