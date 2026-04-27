/** @type {import('tailwindcss').Config} */
/* DCC/Qt theme tokens are mirrored in zeno-plugin/zeno_ui/theme.json — keep colors in sync. */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0a0a0a",
        foreground: "#e5e5e5",
        card: "#141414",
        "card-hover": "#1a1a1a",
        border: "#262626",
        primary: "#d4ff00",
        "primary-foreground": "#0a0a0a",
        muted: "#888888",
        success: "#4ade80",
        warning: "#fbbf24",
        danger: "#ef4444",
        info: "#3b82f6"
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        serif: ["Playfair Display", "serif", "Georgia", "Times New Roman"],
        mono: ["Space Mono", "monospace"],
      }
    },
  },
  plugins: [],
}
