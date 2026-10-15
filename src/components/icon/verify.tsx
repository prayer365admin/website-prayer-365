'use client'

import React from 'react'
import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

// Source: public/icons/icon-verify.svg. Fill is currentColor, size 1em: set color /
// fontSize on the icon (style or className) to theme it.
const IconSvg = () => (
  <>
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6 0C6.84375 0 7.59375 0.492188 7.96875 1.21875C8.74219 0.960938 9.63281 1.14844 10.2422 1.75781C10.8516 2.36719 11.0391 3.25781 10.7812 4.03125C11.5078 4.40625 12 5.15625 12 6C12 6.86719 11.5078 7.61719 10.7812 7.99219C11.0391 8.76562 10.8516 9.63281 10.2422 10.2422C9.63281 10.8516 8.74219 11.0391 7.96875 10.8047C7.59375 11.5312 6.84375 12 6 12C5.13281 12 4.38281 11.5312 4.00781 10.8047C3.23438 11.0391 2.36719 10.8516 1.75781 10.2422C1.14844 9.63281 0.960938 8.76562 1.19531 7.99219C0.46875 7.61719 0 6.86719 0 6C0 5.15625 0.46875 4.40625 1.19531 4.03125C0.960938 3.25781 1.14844 2.36719 1.75781 1.75781C2.36719 1.14844 3.23438 0.960938 4.00781 1.21875C4.38281 0.492188 5.13281 0 6 0ZM8.64844 4.89844L9.04688 4.5L8.25 3.72656L7.85156 4.125L5.25 6.72656L4.14844 5.625L3.75 5.22656L2.95312 6L3.35156 6.39844L4.85156 7.89844L5.25 8.29688L5.64844 7.89844L8.64844 4.89844Z"
        fill="currentColor"
      />
    </svg>
  </>
)

const CustomIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)

export { CustomIcon as VerifyIcon }
