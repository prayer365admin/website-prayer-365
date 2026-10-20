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
    Form: {
      labelHeight: 'auto',
      verticalLabelPadding: '0 0 4px',
      itemMarginBottom: 16,
      // antd sets label size/color itself (beats CSS); weight is left to .site-form.
      labelFontSize: 14,
      labelColor: '#393e46', // --color-neutral-700
    },
    Input: { controlHeight: 48, paddingXXS: 12, borderRadius: 8 },
    Select: { controlHeight: 48, borderRadius: 8 },
  },
}

/** Website archive filter dropdowns (W09 `prayer-2.png`): 40px, dark outline, blue selection. */
export const siteFilterTheme: ThemeConfig = {
  token: {
    controlHeight: 40,
    borderRadius: 8,
    fontSize: 14,
    colorText: '#393e46', // --color-neutral-700
    colorBorder: '#6b7280', // --color-neutral-500
    colorTextPlaceholder: '#393e46', // "All …" placeholders read as the default value
    colorPrimary: '#2f7ad2', // --color-primary-500
  },
  components: {
    Select: {
      hoverBorderColor: '#2f7ad2',
      activeBorderColor: '#2f7ad2',
      optionHeight: 36,
      optionPadding: '8px 12px',
      optionActiveBg: '#f5f7ff', // --color-primary-100
      optionSelectedBg: '#e6edfb', // --color-primary-150
      optionSelectedColor: '#0b4497', // --color-blue-800
      optionSelectedFontWeight: 600,
    },
  },
}
