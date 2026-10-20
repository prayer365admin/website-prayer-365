'use client'

import React from 'react'
import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

const IconSvg = () => (
  <svg width="1em" height="1em" viewBox="0 0 14 13" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M4.12346 3.35802C3.75309 2.98765 3.55556 2.49383 3.55556 1.97531V1.87654C3.55556 0.839506 4.37037 0 5.40741 0C5.97531 0 6.51852 0.271605 6.8642 0.716049L7.11111 0.987654L7.33333 0.716049C7.67901 0.271605 8.22222 0 8.79012 0C9.82716 0 10.6667 0.839506 10.6667 1.87654V1.97531C10.6667 2.49383 10.4444 2.98765 10.0741 3.35802L9.48148 3.95062L7.11111 6.32099L4.74074 3.95062L4.12346 3.35802ZM3.45679 8.09877L3.65432 7.92593H3.95062H5.53086H7.11111H8.69136H9.48148V9.50617H8.69136H7.11111H6.32099V10.2963H9.7284L12.0741 8.69136L12.8889 8.12346L14 9.75309L13.1852 10.321L10.0247 12.4938L9.77778 12.6667H9.48148H5.53086H0.790123H0V9.50617H1.67901L3.45679 8.09877Z"
      fill="currentColor"
    />
  </svg>
)

export const HandHeartIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)
export const HandHoldingHeartIcon = HandHeartIcon
