// theme/themeConfig.ts
import type { ThemeConfig } from 'antd'

const antdTheme: ThemeConfig = {
  token: {
    fontSize: 16,
    colorPrimary: process.env.NEXT_PUBLIC_PRIMARY_COLOR,
    fontFamily: 'var(--font-text)',
  },
}

export default antdTheme

/**
 * Website form fields (WB1 design), applied around the auth forms by
 * AuthLayout. Label hugs its text with a 4px gap to the input, 16px between
 * items, 48px inputs, 12px between the prefix icon and the text. The uneven
 * input padding (8px left, 16px right) has no token: see `.site-form` in
 * src/styles/global.scss.
 */
export const siteFormTheme: ThemeConfig = {
  components: {
    Form: { labelHeight: 'auto', verticalLabelPadding: '0 0 4px', itemMarginBottom: 16 },
    Input: { controlHeight: 48, paddingXXS: 12, borderRadius: 8 },
  },
}
