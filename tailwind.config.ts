import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/contents/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      colors: {
        primary_color: `${process.env.NEXT_PUBLIC_PRIMARY_COLOR}`,
        secondary_color: `${process.env.NEXT_PUBLIC_SECONDARY_COLOR}`,
        accent_color_1: `${process.env.NEXT_PUBLIC_ACCENT_COLOR_1}`,
        accent_color_2: `${process.env.NEXT_PUBLIC_ACCENT_COLOR_2}`,
        black_color: `${process.env.NEXT_PUBLIC_BLACK_COLOR}`,
        white_color: `${process.env.NEXT_PUBLIC_WHITE_COLOR}`,
        // Design tokens; values live in src/styles/global.scss (:root).
        gray: { 100: 'var(--color-gray-100)' },
        blue: {
          50: 'var(--color-blue-50)',
          100: 'var(--color-blue-100)',
          200: 'var(--color-blue-200)',
          800: 'var(--color-blue-800)',
        },
        primary: {
          100: 'var(--color-primary-100)',
          150: 'var(--color-primary-150)',
          300: 'var(--color-primary-300)',
          500: 'var(--color-primary-500)',
          600: 'var(--color-primary-600)',
          700: 'var(--color-primary-700)',
          900: 'var(--color-primary-900)',
          950: 'var(--color-primary-950)',
        },
        neutral: {
          50: 'var(--color-neutral-50)',
          100: 'var(--color-neutral-100)',
          200: 'var(--color-neutral-200)',
          500: 'var(--color-neutral-500)',
          600: 'var(--color-neutral-600)',
          700: 'var(--color-neutral-700)',
        },
        danger: {
          50: 'var(--color-danger-50)',
          200: 'var(--color-danger-200)',
          500: 'var(--color-danger-500)',
          700: 'var(--color-danger-700)',
        },
        warning: { 500: 'var(--color-warning-500)' },
        success: { 500: 'var(--color-success-500)' },
      },
      fontFamily: {
        font_heading: ['var(--font-heading)'],
        font_text: ['var(--font-text)'],
        font_quote: ['var(--font-quote)'],
      },
    },
  },
  plugins: [],
}
export default config
