'use client'

import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

const IconSvg = () => (
  <svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M7.25 7V18H18.25V7H7.25ZM5.75 5.5H19.75V19.5H5.75V5.5ZM12.75 10.1562C12.1875 10.1562 11.75 10.625 11.75 11.1562H10.4375C10.4375 9.875 11.4688 8.84375 12.75 8.84375C14.0312 8.84375 15.0625 9.875 15.0625 11.1562C15.0625 12.2188 14.375 13 13.4062 13.3438V13.9062H12.0938V12.25L12.1875 12.2188C12.8438 12.125 13.75 12 13.75 11.1562C13.75 10.5938 13.3125 10.1562 12.75 10.1562ZM12 14.75H13.5V16.25H12V14.75Z"
      fill="currentColor"
    />
  </svg>
)

const CustomIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)

export { CustomIcon as FirstTimeVisitingIcon }
