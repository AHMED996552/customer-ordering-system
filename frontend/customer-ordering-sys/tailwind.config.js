/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#afc6fc',
        'on-primary': '#002d6b',
        surface: '#0a0a0c',
        'surface-container': '#15161a',
        'surface-container-high': '#1c1d22',
        'on-surface': '#e2e2e6',
        'on-surface-variant': '#909094',
        error: '#ffb4ab',
        'error-container': '#93000a',
        tertiary: '#d7bdf2',
      },
      fontFamily: {
        headline: ['Epilogue', 'sans-serif'],
        body: ['Epilogue', 'sans-serif'],
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
      },
      maxWidth: {
        'container-max': '1200px',
      }
    },
  },
  plugins: [],
}
