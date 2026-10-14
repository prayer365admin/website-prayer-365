'use client'

import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

const IconSvg = () => (
  <svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M12.4766 12.5234C12.4766 12.5508 12.8867 13.6992 13.707 15.9961L16.9336 8.06641L9.00391 11.293L11.875 12.332L12.4766 12.5234ZM7.17188 12.0312L5.3125 11.375L7.14453 10.6367L17.6172 6.37109L19.3125 5.6875L18.6289 7.38281L14.3633 17.8555L13.625 19.6875C13.3242 18.8672 12.5859 16.8164 11.4375 13.5625L7.17188 12.0312Z"
      fill="currentColor"
    />
  </svg>
)

const CustomIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)

export { CustomIcon as PointerIcon }
