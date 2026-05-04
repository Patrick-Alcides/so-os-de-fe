/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eefbf4",
          100: "#d5f5e0",
          500: "#1f9d55",
          700: "#176f3c",
          900: "#0e3d20"
        },
        ink: "#10212d",
        coral: "#c73e1d",
        sand: "#f3efe7"
      },
      boxShadow: {
        panel: "0 20px 45px rgba(16, 33, 45, 0.12)"
      }
    },
  },
  plugins: [],
};
