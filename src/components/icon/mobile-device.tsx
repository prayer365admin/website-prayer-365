'use client'

import React from 'react'
import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

// Source: inline SVG of the "Mobile Sanctuary" badge (welcome/app-promo.tsx). Stroke and
// fill are currentColor, size 1em: set color / fontSize on the icon to theme it.
const IconSvg = () => (
  <>
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 10 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="0.75"
        y="0.75"
        width="8.5"
        height="12.5"
        rx="1.75"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="5" cy="10.5" r="0.75" fill="currentColor" />
    </svg>
  </>
)

const CustomIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)

export { CustomIcon as MobileDeviceIcon }
