'use client'

import React from 'react'
import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

// Source: public/icons/Icon-quote.svg. Fill is currentColor, size 1em: set color /
// fontSize on the icon (style or className) to theme it.
const IconSvg = () => (
  <>
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M17 11.25C17 13.3438 15.3125 15 13.25 15H12.75H12V13.5H12.75H13.25C14.4688 13.5 15.5 12.5 15.5 11.25V11H12.5H11V9.5V6.5V5H12.5H15.5H17V6.5V8V9.5V11V11.25ZM15.5 9.5V8V6.5H12.5V9.5H15.5ZM4.5 9.5H7.5V8V6.5H4.5V9.5ZM9 8V9.5V11V11.25C9 13.3438 7.3125 15 5.25 15H4.75H4V13.5H4.75H5.25C6.46875 13.5 7.5 12.5 7.5 11.25V11H4.5H3V9.5V6.5V5H4.5H7.5H9V6.5V8Z"
        fill="currentColor"
      />
    </svg>
  </>
)

const CustomIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)

export { CustomIcon as QuoteIcon }
