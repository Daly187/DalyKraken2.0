/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Enable dark mode via class strategy
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        // Light theme colors (inspired by DalyTomorrow)
        light: {
          bg: '#f8fafc',
          'bg-secondary': '#ffffff',
          'bg-card': '#ffffff',
          text: '#1e293b',
          'text-secondary': '#64748b',
          'text-muted': '#94a3b8',
          border: '#e2e8f0',
          'border-light': '#f1f5f9',
          sidebar: '#ffffff',
          'sidebar-hover': '#f1f5f9',
          'sidebar-active': '#eff6ff',
        },
        // Dark theme colors
        dark: {
          bg: '#0f172a',
          'bg-secondary': '#1e293b',
          'bg-card': '#1e293b',
          text: '#ffffff',
          'text-secondary': '#9ca3af',
          border: '#334155',
          'border-light': '#475569',
        },
      },
    },
  },
  plugins: [],
}
