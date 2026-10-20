'use client'

import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

// Source: public/icons/icon-calendar-week.svg.
const IconSvg = () => (
  <svg width="1em" height="1em" viewBox="0 0 13 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M4.15625 0V0.65625V1.75H8.09375V0.65625V0H9.40625V0.65625V1.75H12.25V3.9375V5.25V12.6875V14H10.9375H1.3125H0V12.6875V5.25V3.9375V1.75H2.84375V0.65625V0H4.15625ZM10.9375 5.25H1.3125V12.6875H10.9375V5.25ZM9.625 7V9.625H2.625V7H9.625Z"
      fill="currentColor"
    />
  </svg>
)

const CustomIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)

export { CustomIcon as CalendarWeekIcon }
