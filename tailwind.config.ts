import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111111",
        cream: "#FFF9E8",
        yellow: "#FFD700",
        red: "#FF4500",
        blue: "#1E90FF",
        green: "#32CD32",
        violet: "#9B5DE5",
      },
      boxShadow: {
        neo: "4px 4px 0px 0px #111111",
        "neo-lg": "7px 7px 0px 0px #111111",
        "neo-sm": "2px 2px 0px 0px #111111",
        inset: "inset 3px 3px 0px rgba(17,17,17,0.10)",
      },
      borderRadius: {
        blob: "1.75rem",
      },
      keyframes: {
        wobble: {
          "0%, 100%": { transform: "rotate(-1deg)" },
          "50%": { transform: "rotate(1deg)" },
        },
        pop: {
          "0%": { transform: "scale(0.85)" },
          "70%": { transform: "scale(1.06)" },
          "100%": { transform: "scale(1)" },
        },
      },
      animation: {
        wobble: "wobble 1.8s ease-in-out infinite",
        pop: "pop 260ms cubic-bezier(.2,1.5,.5,1)",
      },
    },
  },
  plugins: [],
};

export default config;
