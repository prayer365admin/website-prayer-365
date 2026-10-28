'use client'

import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

// Source: public/icons/Icon-fast-forward.svg. Fill follows currentColor so the
// playback-rate control owns the icon color.
const IconSvg = () => (
  <svg width="1em" height="1em" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M11.75 15.2188L10.4375 16.3125V10.8438L3.875 16.3125V3.1875L10.4375 8.65625V3.1875C10.6016 3.32422 12.8984 5.23828 17.3008 8.90234L18.3125 9.75L17.3008 10.5977L11.75 15.2188ZM16.2617 9.75L11.75 6.00391V13.5234L16.2617 9.75ZM5.1875 13.5234L9.69922 9.75L5.1875 6.00391V13.5234Z"
      fill="currentColor"
    />
  </svg>
)

const CustomIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)

export { CustomIcon as FastForwardIcon }
