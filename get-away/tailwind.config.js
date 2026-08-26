/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ink: "#071525",
        navy: "#0D2340",
        teal: "#1B6672",
        aqua: "#6FE0D0",
        gold: "#F5C96A",
        coral: "#F27C68",
        cloud: "#F5F1E8",
        muted: "#9DB3BC",
        maroon: "#4A0E1B",
        wood: "#6B4423",
        woodLight: "#8A5C35",
      },
      fontFamily: {
        sans: ["System"],
      },
    },
  },
  plugins: [],
};
