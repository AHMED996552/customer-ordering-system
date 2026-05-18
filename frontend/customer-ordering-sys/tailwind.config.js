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
        'headline-md': ['Epilogue', 'sans-serif'],
        'display-xl': ['Epilogue', 'sans-serif'],
        'body-lg': ['Epilogue', 'sans-serif'],
        'body-md': ['Epilogue', 'sans-serif'],
        'label-caps': ['Epilogue', 'sans-serif'],
      },
      fontSize: {
        'display-xl': ['3rem', { lineHeight: '1.2', fontWeight: '700' }],
        'headline-md': ['1.75rem', { lineHeight: '1.3', fontWeight: '600' }],
        'body-lg': ['1.125rem', { lineHeight: '1.6', fontWeight: '400' }],
        'body-md': ['1rem', { lineHeight: '1.5', fontWeight: '400' }],
        'label-caps': ['0.75rem', { lineHeight: '1.4', fontWeight: '600', letterSpacing: '0.1em' }],
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