'use client'

import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

const IconSvg = () => (
  <svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M12.75 17.75C10.9531 17.75 9.3125 16.8125 8.41406 15.25C7.51562 13.707 7.51562 11.8125 8.41406 10.25C9.3125 8.70703 10.9531 7.75 12.75 7.75C14.5273 7.75 16.168 8.70703 17.0664 10.25C17.9648 11.8125 17.9648 13.707 17.0664 15.25C16.168 16.8125 14.5273 17.75 12.75 17.75Z"
      fill="currentColor"
    />
  </svg>
)

const CustomIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)

export { CustomIcon as OpenPrayerIcon }
