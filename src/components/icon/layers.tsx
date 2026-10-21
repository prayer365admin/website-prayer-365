'use client'

import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

export const LayersIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon
    component={() => (
      <svg
        width="1em"
        height="1em"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M8 1.2L1.5 4.8l6.5 3.6 6.5-3.6L8 1.2zm0 5.4L3.4 4.8 8 2.3l4.6 2.5L8 6.6zM1.5 7.8l6.5 3.6 6.5-3.6-1.3-.7-5.2 2.9-5.2-2.9-1.3.7zm0 3.6l6.5 3.6 6.5-3.6-1.3-.7-5.2 2.9-5.2-2.9-1.3.7z"
          fill="currentColor"
        />
      </svg>
    )}
    {...props}
  />
)
