'use client'

import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

const IconSvg = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M3 2.09375L5.37891 4.47266C8.14062 2.06641 12.3242 2.17578 14.9492 4.80078C16.3164 6.16797 17 7.97266 17 9.75C17 13.6055 13.8555 16.75 10 16.75C7.21094 16.75 4.77734 15.1094 3.65625 12.7305L4.85938 12.1836C5.76172 14.0977 7.73047 15.4375 10 15.4375C13.1445 15.4375 15.6875 12.8945 15.6875 9.75C15.6875 8.30078 15.1406 6.85156 14.0195 5.73047C11.9141 3.625 8.55078 3.51562 6.30859 5.40234L8.6875 7.78125H3V2.09375ZM4.3125 5.26562V6.46875H5.51562L4.3125 5.26562Z"
      fill="currentColor"
    />
  </svg>
)

export const RefreshIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)

export default RefreshIcon
