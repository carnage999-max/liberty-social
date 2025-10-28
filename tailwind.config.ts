import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class", // enable dark mode with a .dark class
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* Option C: Bold & Energetic */
        primary: "#0B3D91", // deep cobalt
        secondary: "#FF4D4F", // vibrant warm red accent
        background: "#F6F7FB",
        backgroundDark: "#0B0C0E",
        textLight: "#111827",
        textDark: "#F6F7FB",
        metallicSilver: {
          DEFAULT: "#D1D5DB",
          light: "#F3F4F6",
        },
        metallicAccent: {
          DEFAULT: "#FFDADA",
          light: "#FFECEC",
        },
      },
      fontFamily: {
        montserrat: ["Montserrat", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "12px",
      },
      boxShadow: {
        metallic: "0 4px 6px rgba(0, 0, 0, 0.3)",
      },
      backgroundImage: {
        "metallic-silver": "linear-gradient(180deg, #F3F4F6, #D1D5DB)",
        "metallic-accent": "linear-gradient(180deg, #FFECEC, #FFDADA)",
      },
    },
  },
  plugins: [],
};

export default config;
