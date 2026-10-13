'use client'

import React from 'react'
import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

// Source: public/icons/Icon-arrow-right.svg. Fill is currentColor, size 1em: set color /
// fontSize on the icon (style or className) to theme it.
const IconSvg = () => (
  <>
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M20.7812 12.5312L16.5312 16.7812L16 17.3125L14.9688 16.25L15.5 15.7188L18.4688 12.75H3V11.25H18.4688L15.5 8.28125L14.9688 7.75L16 6.6875L16.5312 7.21875L20.7812 11.4688L21.3125 12L20.7812 12.5312Z"
        fill="currentColor"
      />
    </svg>
  </>
)

const CustomIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)

export { CustomIcon as ArrowRightIcon }
