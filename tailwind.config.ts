import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        base: "5px",
      },
      fontWeight: {
        base: "500",
        heading: "700",
      },
      translate: {
        boxShadowX: "4px",
        boxShadowY: "4px",
        reverseBoxShadowX: "-4px",
        reverseBoxShadowY: "-4px",
      },
      colors: {
        main: "#cc0000",
        "main-foreground": "#ffffff",
        "secondary-background": "#FBFBFC",
        gray: {
          0: "#FFFFFF",
          25: "#FBFBFC",
          50: "#F9FAFB",
          100: "#F3F4F5",
          300: "#D6D9DD",
          400: "#9BA3AE",
          500: "#657080",
          700: "#3C424B",
          900: "#191C20",
        },
        green: {
          100: "#F5FDF7",
          300: "#D6F6DE",
          700: "#00C313", // Kept for existing status badges, can be updated if needed
          800: "#00AB11",
          900: "#18964F",
        },
        red: {
          100: "#FFF0F0",
          300: "#FFCCCC",
          700: "#cc0000", // Main action color
          800: "#aa0000", // Darker hover
          900: "#880000", // Kept for other uses if any
        },
        yellow: {
          // Kept for existing status badges, can be updated if needed
          100: "#FFF9EF",
          300: "#FFEECE",
          700: "#FFB11B",
          800: "#DC8F00",
          900: "#B47500",
        },
        blue: {
          100: "#F3F8FF",
          300: "#CEE2FF",
          700: "#5A9CFF",
          800: "#0025DC",
          900: "#054CB7",
        },
        teal: {
          600: "#00A0A0",
          700: "#008080",
        },
        purple: {
          // Added purple for ContentStats
          600: "#7C3AED", // Example purple, adjust if specific shade is preferred
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        shadowColor: "#1B1B1B", // Custom color for shadows
      },
      boxShadow: {
        shadow: "4px 4px 0px 0px #1B1B1B",
        "custom-sm": "3.2px 3.2px 0px 0px var(--tw-shadow-color, #1B1B1B)",
        "custom-md": "6.4px 6.4px 0px 0px var(--tw-shadow-color, #1B1B1B)",
        "custom-md-hover": "8px 8px 0px 0px var(--tw-shadow-color, #1B1B1B)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

export default config
