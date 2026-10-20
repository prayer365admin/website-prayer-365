'use client'

import React from 'react'
import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

const IconSvg = () => (
  <svg width="1em" height="1em" viewBox="0 0 11 7" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M5.48579 6.48062H5.51421L5.03101 5.99742L0.483204 1.44961L0 0.966408L0.966408 0L1.44961 0.483204L5.51421 4.5478L9.57881 0.483204L10.062 0L11 0.966408L10.5168 1.44961L5.96899 5.99742L5.48579 6.48062Z"
      fill="currentColor"
    />
  </svg>
)

export const AngleDownIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)
