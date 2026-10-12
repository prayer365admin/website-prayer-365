'use client'

import React from 'react'
import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

// Source: public/icons/icon-lock.svg. Fill is currentColor, size 1em: set color /
// fontSize on the icon (style or className) to theme it.
const IconSvg = () => (
  <>
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 11 15"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3.0625 3.5V5.25H7.4375V3.5C7.4375 2.29688 6.45312 1.3125 5.25 1.3125C4.04688 1.3125 3.0625 2.29688 3.0625 3.5ZM1.75 6.5625H1.3125V13.5625H9.1875V6.5625H8.75H7.4375H3.0625H1.75ZM1.75 5.25V3.5C1.75 1.55859 3.30859 0 5.25 0C7.19141 0 8.75 1.55859 8.75 3.5V5.25H10.5V14.875H0V5.25H1.75Z"
        fill="currentColor"
      />
    </svg>
  </>
)

const CustomIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)

export { CustomIcon as LockIcon }
