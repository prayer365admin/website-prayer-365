'use client'

import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

// Source: public/icons/icon-search.svg.
const IconSvg = () => (
  <svg width="1em" height="1em" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M8.60156 4.875C8.60156 2.8125 6.9375 1.125 4.85156 1.125C2.78906 1.125 1.10156 2.8125 1.10156 4.875C1.10156 6.9375 2.78906 8.625 4.85156 8.625C6.9375 8.625 8.60156 6.9375 8.60156 4.875ZM7.89844 8.69531C7.05469 9.35156 6 9.75 4.875 9.75C2.17969 9.75 0 7.57031 0 4.875C0 2.17969 2.17969 0 4.875 0C7.54688 0 9.75 2.17969 9.75 4.875C9.75 6.02344 9.35156 7.07812 8.69531 7.89844L11.8359 11.0391L12.2344 11.4375L11.4375 12.2344L11.0391 11.8359L7.89844 8.69531Z"
      fill="currentColor"
    />
  </svg>
)

const CustomIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)

export { CustomIcon as SearchIcon }
