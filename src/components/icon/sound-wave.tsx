'use client'

import React from 'react'
import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

// Sound wave bars (WB1 design, "LIVE" badge). Fill is currentColor, size 1em:
// set color / fontSize on the icon (style or className) to theme it.
const IconSvg = () => (
  <>
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 14 15"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3 12V3H4.5V12H3ZM6 15V0H7.5V15H6ZM0 9V6H1.5V9H0ZM9 12V3H10.5V12H9ZM12 9V6H13.5V9H12Z"
        fill="currentColor"
      />
    </svg>
  </>
)

const CustomIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)

export { CustomIcon as SoundWaveIcon }
