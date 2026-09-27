'use client'

import React from 'react'
import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

const IconSvg = () => (
  <>
    <svg width="18" height="22" viewBox="0 0 18 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M5 13.5351C2.60879 14.2267 1 15.5194 1 17C1 19.2091 4.58172 21 9 21C13.4183 21 17 19.2091 17 17C17 15.5194 15.3912 14.2267 13 13.5351M15 7.4C15 10.9346 10.5 17 9 17C7.5 17 3 10.9346 3 7.4C3 3.86538 5.68629 1 9 1C12.3137 1 15 3.86538 15 7.4ZM11 7C11 8.10457 10.1046 9 9 9C7.89543 9 7 8.10457 7 7C7 5.89543 7.89543 5 9 5C10.1046 5 11 5.89543 11 7Z"
        stroke="#FDFDFD"
      />
    </svg>
  </>
)

const CustomIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)

export { CustomIcon as LocationPinIcon }
