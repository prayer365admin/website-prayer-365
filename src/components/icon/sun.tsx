'use client'

import React from 'react'
import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

// Source: public/icons/icon-sun.svg. Fill is currentColor, size 1em: set color /
// fontSize on the icon (style or className) to theme it.
const IconSvg = () => (
  <>
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 21 21"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M9.16667 2.75V0H11V2.75H9.16667ZM9.16667 20.1667V17.4167H11V20.1667H9.16667ZM17.4167 11V9.16667H20.1667V11H17.4167ZM0 11V9.16667H2.75V11H0ZM16.225 5.225L14.9417 3.94167L16.5458 2.29167L17.875 3.62083L16.225 5.225ZM3.62083 17.875L2.29167 16.5458L3.94167 14.9417L5.225 16.225L3.62083 17.875ZM16.5458 17.875L14.9417 16.225L16.225 14.9417L17.875 16.5458L16.5458 17.875ZM3.94167 5.225L2.29167 3.62083L3.62083 2.29167L5.225 3.94167L3.94167 5.225ZM10.0833 15.5833C8.55556 15.5833 7.25694 15.0486 6.1875 13.9792C5.11806 12.9097 4.58333 11.6111 4.58333 10.0833C4.58333 8.55556 5.11806 7.25694 6.1875 6.1875C7.25694 5.11806 8.55556 4.58333 10.0833 4.58333C11.6111 4.58333 12.9097 5.11806 13.9792 6.1875C15.0486 7.25694 15.5833 8.55556 15.5833 10.0833C15.5833 11.6111 15.0486 12.9097 13.9792 13.9792C12.9097 15.0486 11.6111 15.5833 10.0833 15.5833Z"
        fill="currentColor"
      />
    </svg>
  </>
)

const CustomIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)

export { CustomIcon as SunIcon }
