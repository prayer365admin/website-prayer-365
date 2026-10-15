'use client'

import React from 'react'
import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

// Source: public/icons/icon-pilgrim.svg. Fill is currentColor, size 1em: set color /
// fontSize on the icon (style or className) to theme it.
const IconSvg = () => (
  <>
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M5.90625 0H14V14H0V2.625H5.25V0H5.90625ZM7 12.6875H12.6875V1.3125H6.5625V12.6875H7ZM5.25 12.6875V3.9375H1.3125V12.6875H5.25ZM4.375 5.25V7H2.625V5.25H4.375ZM2.625 7.875H4.375V9.625H2.625V7.875ZM10.0625 2.625H11.8125V4.375H10.0625V2.625ZM9.1875 2.625V4.375H7.4375V2.625H9.1875ZM10.0625 5.25H11.8125V7H10.0625V5.25ZM11.8125 7.875V9.625H10.0625V7.875H11.8125ZM7.4375 5.25H9.1875V7H7.4375V5.25ZM9.1875 7.875V9.625H7.4375V7.875H9.1875Z"
        fill="currentColor"
      />
    </svg>
  </>
)

const CustomIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)

export { CustomIcon as PilgrimIcon }
