import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/pages/**/*.{ts,tsx}", "./src/components/**/*.{ts,tsx}", "./src/app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17202a",
        paper: "#f6f7f4",
        moss: "#73876b",
        coral: "#e7775c",
        sky: "#8cb8c9",
        lavender: "#aea4c8",
      },
      boxShadow: {
        card: "0 14px 40px rgba(23, 32, 42, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
