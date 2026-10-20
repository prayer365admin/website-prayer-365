'use client'

import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

// Source: public/icons/Icon-giving.svg.
const IconSvg = () => (
  <svg width="1em" height="1em" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M12.5 5.21875L12.75 5.59375L13.0312 5.21875C13.4688 4.625 14.1562 4.25 14.9062 4.25C16.2188 4.25 17.25 5.3125 17.25 6.59375V6.65625C17.25 9.34375 12.75 12.25 12.75 12.25C12.75 12.25 8.25 9.34375 8.25 6.65625V6.59375C8.25 5.3125 9.3125 4.25 10.5938 4.25C11.3438 4.25 12.0625 4.625 12.5 5.21875ZM8.78125 13.5H15.75V16H16.0312C18.4062 14.5 19.625 13.75 19.6562 13.7188C19.75 13.8438 20.375 14.9062 21.5625 16.875L21.9375 17.5L21.3125 17.875L17.4062 20.375L17.25 20.5H3.78125V19H16.8125L19.9062 17L19.1562 15.8125L16.6562 17.375L16.5 17.5H11.0312V16H14.2812V15H9.25L6.4375 16.875L6.25 17H3.78125V15.5H5.78125L8.59375 13.625L8.78125 13.5Z"
      fill="currentColor"
    />
  </svg>
)

const CustomIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)

export { CustomIcon as GivingIcon }
