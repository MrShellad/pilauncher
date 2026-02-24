/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
  colors: {
    bg: "#111315",
    panel: "rgba(255,255,255,0.05)",
    borderSoft: "rgba(255,255,255,0.08)",
    accent: "#5ea6ff",
    danger: "#ff5e5e"
  },
  borderRadius: {
    ore: "16px"
  },
  boxShadow: {
    ore: "0 0 0 1px rgba(255,255,255,0.06), 0 12px 32px rgba(0,0,0,0.45)"
  }
}
  },
  plugins: [],
}