/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: '#0f172a',
        darker: '#020617',
        panel: '#1e293b',
        'panel-border': '#334155',
        primary: '#3b82f6',
      },
    },
  },
  plugins: [],
}
