/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      // ── Custom Fonts ──────────────────────────────────────────────────────
      fontFamily: {
        headline: ["'Epilogue'", "sans-serif"],
        body: ["'Manrope'", "sans-serif"],
        display: ["'Space Grotesk'", "sans-serif"],
      },
      // ── Custom Colors (Material You – dark surface palette) ───────────────
      colors: {
        background: "#0f0f13",
        "on-background": "#e4e2eb",
        surface: "#1a1a20",
        "surface-container-lowest": "#141418",
        "surface-container-high": "#272730",
        "on-surface": "#e4e2eb",
        "on-surface-variant": "#c9c5d0",
        "outline-variant": "#47444e",
        primary: "#afc6fc",
        "on-primary": "#0e2a64",
        "primary-container": "#28447e",
        "primary-fixed-dim": "#8eabee",
        "secondary-container": "#3c3f5a",
      },
      // ── Custom Spacing ────────────────────────────────────────────────────
      spacing: {
        xs: "4px",
        sm: "8px",
        base: "12px",
        md: "16px",
        lg: "24px",
        xl: "32px",
        "2xl": "48px",
      },
      // ── Custom Font Sizes ─────────────────────────────────────────────────
      fontSize: {
        "label-caps": ["11px", { lineHeight: "16px", letterSpacing: "0.1em" }],
        "body-md": ["14px", { lineHeight: "20px" }],
        "headline-md": ["28px", { lineHeight: "36px" }],
      },
      // ── Box Shadows ───────────────────────────────────────────────────────
      boxShadow: {
        glow: "0 0 20px rgba(175,198,252,0.3)",
        "glow-lg": "0 0 30px rgba(175,198,252,0.5)",
      },
      // ── Border Radius ─────────────────────────────────────────────────────
      borderRadius: {
        "2xl": "16px",
        "3xl": "24px",
        "4xl": "32px",
      },
    },
  },
  plugins: [],
};
