/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        "on-secondary": "#003256",
        "primary-container": "#011f4b",
        "tertiary": "#b0cadd",
        "on-tertiary": "#1a3342",
        "error-container": "#93000a",
        "surface": "#121316",
        "on-tertiary-fixed-variant": "#314a59",
        "on-error": "#690005",
        "tertiary-container": "#072331",
        "on-secondary-fixed-variant": "#00497a",
        "on-secondary-container": "#a9d1ff",
        "secondary-fixed-dim": "#9ccaff",
        "primary": "#afc6fc",
        "surface-variant": "#343538",
        "outline-variant": "#44474f",
        "secondary": "#9ccaff",
        "inverse-on-surface": "#2f3034",
        "surface-tint": "#afc6fc",
        "surface-container": "#1f1f23",
        "surface-container-low": "#1b1b1f",
        "on-secondary-fixed": "#001d35",
        "primary-fixed": "#d8e2ff",
        "inverse-surface": "#e3e2e6",
        "on-primary-fixed": "#001a42",
        "surface-container-lowest": "#0d0e11",
        "inverse-primary": "#475e8d",
        "surface-container-high": "#292a2d",
        "surface-bright": "#38393d",
        "on-primary": "#162f5b",
        "secondary-container": "#005a95",
        "on-surface-variant": "#c4c6d0",
        "on-primary-container": "#7188b9",
        "tertiary-fixed": "#cce6fa",
        "on-primary-fixed-variant": "#2f4673",
        "tertiary-fixed-dim": "#b0cadd",
        "surface-dim": "#121316",
        "surface-container-highest": "#343538",
        "secondary-fixed": "#d0e4ff",
        "background": "#121316",
        "primary-fixed-dim": "#afc6fc",
        "on-tertiary-container": "#728b9d",
        "on-surface": "#e3e2e6",
        "error": "#ffb4ab",
        "on-tertiary-fixed": "#021e2c",
        "on-background": "#e3e2e6",
        "outline": "#8e909a",
        "on-error-container": "#ffdad6"
      },
      borderRadius: {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "full": "9999px"
      },
      spacing: {
        "xl": "80px",
        "container-max": "1440px",
        "base": "8px",
        "lg": "48px",
        "gutter": "32px",
        "xs": "4px",
        "sm": "12px",
        "md": "24px"
      },
      fontFamily: {
        "headline-lg": ["Epilogue", "sans-serif"],
        "headline-md": ["Epilogue", "sans-serif"],
        "label-caps": ["Space Grotesk", "sans-serif"],
        "display-xl": ["Epilogue", "sans-serif"],
        "body-md": ["Manrope", "sans-serif"],
        "body-lg": ["Manrope", "sans-serif"]
      },
      fontSize: {
        "headline-lg": ["48px", { "lineHeight": "1.2", "letterSpacing": "-0.02em", "fontWeight": "700" }],
        "headline-md": ["32px", { "lineHeight": "1.3", "fontWeight": "600" }],
        "label-caps": ["12px", { "lineHeight": "1", "letterSpacing": "0.1em", "fontWeight": "700" }],
        "display-xl": ["72px", { "lineHeight": "1.1", "letterSpacing": "-0.04em", "fontWeight": "800" }],
        "body-md": ["16px", { "lineHeight": "1.6", "fontWeight": "400" }],
        "body-lg": ["18px", { "lineHeight": "1.6", "fontWeight": "400" }]
      }
    },
  },
  plugins: [],
}
