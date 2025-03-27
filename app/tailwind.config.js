/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      spacing: {
        18: "4.5rem",
        120: "30rem",
        128: "32rem",
      },
      fontSize: {
        xxs: ["10px", "12px"],
      },
      screens: {
        xs: "20px",
      },
      colors: {
        main: "#006625",
        light: "#007A2D",
        neutral: "#9CA3AF",
        warning: "#FCA311",
        "hsg-50": "#EBFFF2",
        "hsg-100": "#CCFFDF",
        "hsg-200": "#99FFBE",
        "hsg-300": "#57FF94",
        "hsg-400": "#0AFF64",
        "hsg-500": "#00C749",
        "hsg-600": "#009938",
        "hsg-700": "#007A2D",
        "hsg-800": "#006625",
        "hsg-900": "#00521E",
      },
      width: {
        "1/8": "12.5%",
        "3/8": "37.5%",
        "5/8": "62.5%",
        "7/8": "87.5%",
        custom64: "64px",
        custom50: "47px",
      },
      translate: {
        "1/6": "16.6666666667%",
        "2/6": "33.3333333333%",
        "8/10": "80%",
        "-8/10": "-80%",
        "9/10": "90%",
        "-9/10": "-90%",
      },
      height: {
        "1/10": "10%",
        "9/10": "90%",
        "11/12": "92%",
      },
      inset: {
        "1/10": "10%",
        "9/10": "90%",
      },
    },
  },
  variants: {
    extend: {
      display: ["hover", "focus", "group-hover"],
      backgroundColor: ["active"],
    },
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("tailwind-scrollbar-hide"),
    require("@tailwindcss/typography"),
  ],
};
