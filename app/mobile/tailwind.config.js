/**
 * ResQKit brand palette (logo-derived), ported from app/frontend/tailwind.config.ts
 * so both apps share the same semantic color names. Values live in
 * src/global.css as CSS custom properties, same pattern as the web app.
 * darkMode is 'class' (not 'media') so Settings' toggle can drive it manually
 * via nativewind's own useColorScheme/setColorScheme, not just OS preference.
 */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Fraunces', 'serif'],
        serif: ['Fraunces', 'serif'],
        mono: ['Fira Code', 'monospace'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          tint: 'hsl(var(--primary-tint))',
          'tint-foreground': 'hsl(var(--primary-tint-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
          tint: 'hsl(var(--secondary-tint))',
          'tint-foreground': 'hsl(var(--secondary-tint-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
          tint: 'hsl(var(--destructive-tint))',
          'tint-foreground': 'hsl(var(--destructive-tint-foreground))',
        },
        // The only reserved red — 112 / hazard / critical-step UI. Never used
        // for generic "delete" actions, which stay on `destructive` (neutral).
        emergency: {
          DEFAULT: 'hsl(var(--emergency))',
          foreground: 'hsl(var(--emergency-foreground))',
          tint: 'hsl(var(--emergency-tint))',
          'tint-foreground': 'hsl(var(--emergency-tint-foreground))',
        },
        // Second-tier urgency — never the reserved red, see global.css.
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
          tint: 'hsl(var(--warning-tint))',
          'tint-foreground': 'hsl(var(--warning-tint-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 0.5rem)',
        sm: 'calc(var(--radius) - 1rem)',
      },
    },
  },
  plugins: [],
};
