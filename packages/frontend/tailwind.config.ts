import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
      colors: {
        // Zaka-Stream brand palette
        brand: {
          50:  "#f0f4ff",
          100: "#e0e9ff",
          200: "#b9cbff",
          300: "#7c9dff",
          400: "#3b68ff",
          500: "#1447ff",
          600: "#0530f5",
          700: "#0424e1",
          800: "#0a1fb6",
          900: "#0e1e8f",
          950: "#0a1260",
        },
        accent: {
          cyan:   "#00e5ff",
          purple: "#a855f7",
          green:  "#10d48e",
          amber:  "#f59e0b",
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "hero-gradient":
          "linear-gradient(135deg, #0a1260 0%, #1447ff 50%, #00e5ff 100%)",
        "card-gradient":
          "linear-gradient(145deg, rgba(20,71,255,0.15) 0%, rgba(0,229,255,0.05) 100%)",
        "stream-active":
          "linear-gradient(90deg, #1447ff, #00e5ff, #a855f7)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "stream-flow": "streamFlow 2s linear infinite",
        "counter-tick": "counterTick 0.1s ease-out",
        "fade-in": "fadeIn 0.4s ease-out",
        "slide-up": "slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
        "glow": "glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        streamFlow: {
          "0%":   { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" },
        },
        counterTick: {
          "0%":   { transform: "translateY(-4px)", opacity: "0" },
          "100%": { transform: "translateY(0)",    opacity: "1" },
        },
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%":   { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)",    opacity: "1" },
        },
        glow: {
          "0%":   { boxShadow: "0 0 20px rgba(20,71,255,0.3)" },
          "100%": { boxShadow: "0 0 40px rgba(0,229,255,0.6)" },
        },
      },
      boxShadow: {
        "brand-glow": "0 0 40px rgba(20, 71, 255, 0.4)",
        "cyan-glow":  "0 0 30px rgba(0, 229, 255, 0.35)",
        "card": "0 4px 24px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.08)",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};

export default config;
