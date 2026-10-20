'use client'

import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

// Source: public/icons/icon-unbookmark.svg.
const IconSvg = () => (
  <svg width="1em" height="1em" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M3.46484 2.28516L4.75 3.57031V2.75H15.25V14.0703C17.0273 15.8477 17.9297 16.75 17.9297 16.75L17 17.6797L16.5352 17.2148L2.53516 3.21484L2.07031 2.75L3 1.82031L3.46484 2.28516ZM6.0625 4.88281L13.9375 12.7578V4.0625H6.0625V4.88281ZM10.1641 12.7031L13.8281 16.3672L10 14.125L4.75 17.1875V7.28906L6.0625 8.60156V14.918L9.34375 13.0039L10 12.6211L10.1641 12.7031Z"
      fill="currentColor"
    />
  </svg>
)

const CustomIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)

export { CustomIcon as UnbookmarkIcon }
