'use client'

import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

const IconSvg = () => (
  <svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M18.75 7.11719V8.125V9.8125V15.625C18.75 16.6797 17.7422 17.5 16.5 17.5C15.2578 17.5 14.25 16.6797 14.25 15.625C14.25 14.5938 15.2578 13.75 16.5 13.75C16.7578 13.75 17.0156 13.7969 17.25 13.8672V10.8203L11.25 12.625V17.125C11.25 18.1797 10.2422 19 9 19C7.75781 19 6.75 18.1797 6.75 17.125C6.75 16.0938 7.75781 15.25 9 15.25C9.25781 15.25 9.51562 15.2969 9.75 15.3672V12.0625V10.375V9.83594L10.2656 9.67188L17.7656 7.42188L18.75 7.11719Z"
      fill="currentColor"
    />
  </svg>
)

const CustomIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)

export { CustomIcon as MusicIcon }
