/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/src/**/*.{js,ts,jsx,tsx}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        surface: {
          DEFAULT: 'var(--color-surface)',
          elevated: 'var(--color-surface-elevated)',
          muted: 'var(--color-surface-muted)',
          hover: 'var(--color-surface-hover)',
        },
        card: {
          DEFAULT: 'var(--color-surface-elevated)',
          border: 'var(--color-border)',
        },
        border: {
          DEFAULT: 'var(--color-border)',
          subtle: 'var(--color-border-subtle)',
          strong: 'var(--color-border-strong)',
        },
        foreground: {
          DEFAULT: 'var(--color-text)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
          subtle: 'var(--color-text-subtle)',
        },
        'muted-foreground': 'var(--color-text-muted)',
        muted: {
          DEFAULT: 'var(--color-surface-muted)',
          foreground: 'var(--color-text-muted)',
        },
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          active: 'var(--color-primary-active)',
          foreground: 'var(--color-primary-foreground)',
          muted: 'var(--color-primary-muted)',
          ring: 'var(--color-primary-ring)',
        },
        sidebar: {
          DEFAULT: 'var(--color-sidebar)',
          border: 'var(--color-sidebar-border)',
          text: 'var(--color-sidebar-text)',
          muted: 'var(--color-sidebar-muted)',
          active: 'var(--color-sidebar-active)',
        },
        header: {
          DEFAULT: 'var(--color-header)',
          border: 'var(--color-header-border)',
        },
        status: {
          success: 'var(--color-success)',
          warning: 'var(--color-warning)',
          danger: 'var(--color-danger)',
          info: 'var(--color-info)',
        },
        brand: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316', // RS ORANGE brand primary
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
          950: '#431407',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace']
      }
    },
  },
  plugins: [],
}
