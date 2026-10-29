'use client'

import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

// Source: public/icons/icon-download.svg. Fill follows currentColor so the same
// component can be reused on different control surfaces.
const IconSvg = () => (
  <svg width="1em" height="1em" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M10.9648 12.1836L10.5 12.6484L10.0352 12.1836L6.31641 8.46484L5.85156 8L6.78125 7.07031L7.24609 7.53516L9.84375 10.1328V2.75H11.1562V10.1328L13.7539 7.53516L14.2188 7.07031L15.1484 8L14.6836 8.46484L10.9648 12.1836ZM5.6875 12.1562V15.4375H15.3125V11.5H16.625V16.75H4.375V11.5H5.6875V12.1562Z"
      fill="currentColor"
    />
  </svg>
)

const CustomIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)

export { CustomIcon as DownloadIcon }
