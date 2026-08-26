/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ink: "#071525",
        navy: "#0D2340",
        felt: "#123B4A",
        teal: "#1B6672",
        aqua: "#6FE0D0",
        gold: "#F5C96A",
        coral: "#F27C68",
        cloud: "#F5F1E8",
        muted: "#9DB3BC",
        line: "rgba(245,241,232,0.16)",
        maroon: "#4A0E1B",
        feltDeep: "#0E2B1A",
        wood: "#5C3A1E",
        woodLight: "#7A5230",
        woodDark: "#3D2512",
        maroonFelt: "#2D0A12",
        trickSlot: "rgba(111,224,208,0.10)",
      },
      fontFamily: {
        sans: ["System"],
      },
      /* ── Card Design Tokens ──────────────────────────────── */
      cardBg: {
        face: "#ffffff",
        faceRed: "#FFF5F5",
        faceBlack: "#F8FAFC",
        back: "#1B6672",
        backPattern: "#155A66",
      },
      cardBorder: {
        default: "#D1D5DB",
        playable: "#F5C96A",
        dimmed: "#9CA3AF",
        selected: "#6FE0D0",
      },
      cardShadow: {
        sm: "0 1px 3px rgba(0,0,0,0.12)",
        md: "0 4px 12px rgba(0,0,0,0.15)",
        lg: "0 8px 24px rgba(0,0,0,0.2)",
        glow: "0 0 20px rgba(245,201,106,0.5)",
      },
      cardRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
      },
      cardSize: {
        icon: "28px",
        rank: "14px",
        miniIcon: "14px",
        miniRank: "8px",
      },
      /* ── Card Gradient Tokens (for LinearGradient use) ──── */
      cardGradient: {
        face: ["#ffffff", "#FAFAFA"],
        faceRed: ["#FFF5F5", "#FFE8E8"],
        faceBlack: ["#F8FAFC", "#F0F4F8"],
        back: ["#1B6672", "#155A66"],
      },
      /* ── Menu & Onboarding Design Tokens ────────────────── */
      glassBg: {
        light: "rgba(255,255,255,0.06)",
        medium: "rgba(255,255,255,0.10)",
        heavy: "rgba(255,255,255,0.15)",
      },
      menuCard: {
        primary: "rgba(27,102,114,0.85)",
        secondary: "rgba(13,35,64,0.70)",
        subtle: "rgba(255,255,255,0.05)",
      },
      glowColor: {
        aqua: "rgba(111,224,208,0.25)",
        gold: "rgba(245,201,106,0.20)",
        teal: "rgba(27,102,114,0.30)",
      },
      onboardingCard: {
        bg: "rgba(27,102,114,0.60)",
        border: "rgba(111,224,208,0.35)",
        inner: "rgba(255,255,255,0.06)",
      },
    },
  },
  plugins: [],
};
