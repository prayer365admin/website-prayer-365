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
      },
      fontFamily: {
        font_heading: ['var(--font-heading)'],
        font_text: ['var(--font-text)'],
      },
    },
  },
  plugins: [],
}
export default config
