'use client'

import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

const IconSvg = () => (
  <svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M13.4062 4.375V5.6875H14.9375V7H13.4062V8.17578L16.8242 10.3906L17.125 10.582V11.8672L19.4219 13.207L19.75 13.3984V19.25H5.75V13.3984L6.07812 13.207L8.375 11.8672V10.582L8.67578 10.3906L12.0938 8.17578V7H10.5625V5.6875H12.0938V4.375H13.4062ZM9.6875 12.25V17.9375H11V14H14.5V17.9375H15.8125V11.293L12.75 9.32422L9.6875 11.293V12.25ZM17.125 17.9375H18.4375V14.1641L17.125 13.3984V17.9375ZM8.375 13.3984L7.0625 14.1641V17.9375H8.375V13.3984Z"
      fill="currentColor"
    />
  </svg>
)

const CustomIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)

export { CustomIcon as ChurchIcon }
