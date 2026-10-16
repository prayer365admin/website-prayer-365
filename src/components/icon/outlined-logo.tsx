'use client'

import React from 'react'
import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

// Outlined praying-hands logo (WB1 design, white on dark cards). Fill and
// stroke are currentColor, size 1em: set color / fontSize to theme it.
const IconSvg = () => (
  <>
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M38.8008 17.5999C38.8008 18.2622 39.3385 18.7999 40.0008 18.7999C40.6631 18.7999 41.2008 18.2622 41.2008 17.5999C41.2008 16.9376 40.6631 16.3999 40.0008 16.3999C39.3385 16.3999 38.8008 16.9376 38.8008 17.5999Z"
        fill="currentColor"
      />
      <path
        d="M38.8008 17.5999C38.8008 18.2622 39.3385 18.7999 40.0008 18.7999C40.6631 18.7999 41.2008 18.2622 41.2008 17.5999C41.2008 16.9376 40.6631 16.3999 40.0008 16.3999C39.3385 16.3999 38.8008 16.9376 38.8008 17.5999V17.5999"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        opacity="0.9"
        d="M40.0008 6.3999V28.7999M28.8008 17.5999H51.2008M32.8008 10.3999L47.2008 24.7999M32.8008 24.7999L47.2008 10.3999"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M28.8008 54.4001C27.2008 40.0001 35.2008 30.4001 36.8008 25.6001C38.4008 30.4001 38.4008 44.0001 33.6008 60.8001C32.0008 65.6001 25.6008 68.8001 20.8008 67.2001C24.0008 60.8001 27.2008 57.6001 28.8008 54.4001Z"
        fill="currentColor"
        fillOpacity="0.25"
      />
      <path
        d="M28.8008 54.4001C27.2008 40.0001 35.2008 30.4001 36.8008 25.6001C38.4008 30.4001 38.4008 44.0001 33.6008 60.8001C32.0008 65.6001 25.6008 68.8001 20.8008 67.2001C24.0008 60.8001 27.2008 57.6001 28.8008 54.4001V54.4001"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M51.1991 54.4001C52.7991 40.0001 44.7991 30.4001 43.1991 25.6001C41.5991 30.4001 41.5991 44.0001 46.3991 60.8001C47.9991 65.6001 54.3991 68.8001 59.1991 67.2001C55.9991 60.8001 52.7991 57.6001 51.1991 54.4001Z"
        fill="currentColor"
        fillOpacity="0.25"
      />
      <path
        d="M51.1991 54.4001C52.7991 40.0001 44.7991 30.4001 43.1991 25.6001C41.5991 30.4001 41.5991 44.0001 46.3991 60.8001C47.9991 65.6001 54.3991 68.8001 59.1991 67.2001C55.9991 60.8001 52.7991 57.6001 51.1991 54.4001V54.4001"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        opacity="0.7"
        d="M24 67.2C34.6667 72.5333 45.3333 72.5333 56 67.2"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="1.6 2.4"
      />
    </svg>
  </>
)

const CustomIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)

export { CustomIcon as OutlinedLogoIcon }
