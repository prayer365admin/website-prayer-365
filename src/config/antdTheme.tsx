// theme/themeConfig.ts
import type { ThemeConfig } from 'antd'

const antdTheme: ThemeConfig = {
  cssVar: true,
  token: {
    fontSize: 16,
    colorPrimary: process.env.NEXT_PUBLIC_PRIMARY_COLOR,
    fontFamily: 'var(--font-text)',
  },
}

export default antdTheme
