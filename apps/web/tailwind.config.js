/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
        },
        category: {
          dev: "#3b82f6",
          ai: "#8b5cf6",
          sales: "#10b981",
          design: "#ec4899",
          other: "#6b7280",
        },
      },
    },
  },
  plugins: [],
};
