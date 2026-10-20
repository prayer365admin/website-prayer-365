'use client'

import React from 'react'
import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

const IconSvg = () => (
  <svg width="1em" height="1em" viewBox="0 0 18 17" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M4.75 0V0.75V2H9.25V0.75V0H10.75V0.75V2H14V4.5V6H13.5H12.5H9H1.5V14.5H8.875C9.25 15.0938 9.75 15.625 10.3125 16H1.5H0V14.5V6V4.5V2H3.25V0.75V0H4.75ZM9 11.5C9 9.90625 9.84375 8.4375 11.25 7.625C12.625 6.8125 14.3438 6.8125 15.75 7.625C17.125 8.4375 18 9.90625 18 11.5C18 13.125 17.125 14.5938 15.75 15.4062C14.3438 16.2188 12.625 16.2188 11.25 15.4062C9.84375 14.5938 9 13.125 9 11.5ZM14 9H13V9.5V11.5V12H13.5H15H15.5V11H15H14V9.5V9Z"
      fill="currentColor"
    />
  </svg>
)

export const CalendarClockIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)
