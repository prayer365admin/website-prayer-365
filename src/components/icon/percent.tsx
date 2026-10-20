'use client'

import React from 'react'
import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

const IconSvg = () => (
  <svg width="1em" height="1em" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M12.4304 1.67526L1.70876 12.3969L1.13918 12.9665L0 11.8273L0.569588 11.2577L11.2912 0.536082L11.8608 0L13 1.10567L12.4304 1.67526ZM0.603093 0.569588H3.81959V3.78608H0.603093V0.569588ZM9.18041 9.14691H12.3969V12.3634H9.18041V9.14691Z"
      fill="currentColor"
    />
  </svg>
)

export const PercentIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)
