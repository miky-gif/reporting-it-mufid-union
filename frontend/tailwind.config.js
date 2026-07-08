/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Bleu pétrole · marque
        petrole: {
          900: "#072F3F",
          800: "#093646",
          700: "#0B4A61",
          600: "#0E5E7C",
          500: "#14708F",
          100: "#E3EFF3",
          50: "#F0F6F8",
        },
        // Neutres
        encre: "#16262E",
        ardoise: "#33454F",
        gris: "#5E717B",
        grisdoux: "#8A99A1",
        bordure: "#E2E8EB",
        surface: "#F4F6F7",
        fond: "#E9EDEF",
        // Sémantique · statuts
        succes: "#1B8A4B",
        info: "#14708F",
        attention: "#D08A21",
        danger: "#C0392B",
        // Catégories IT
        cat: {
          dev: "#2F6FE0",
          cyber: "#7E57C2",
          infra: "#0E5E7C",
          support: "#1F9D74",
          maintenance: "#D08A21",
          reporting: "#64757D",
        },
      },
      fontFamily: {
        sans: ["'IBM Plex Sans'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "monospace"],
      },
      boxShadow: {
        carte: "0 1px 2px rgba(9,54,70,.04)",
        panneau: "0 24px 60px -32px rgba(9,54,70,.4), 0 0 0 1px rgba(9,54,70,.06)",
        popover: "0 12px 40px -12px rgba(9,54,70,.28)",
      },
      borderRadius: {
        xl2: "12px",
      },
    },
  },
  plugins: [],
};
