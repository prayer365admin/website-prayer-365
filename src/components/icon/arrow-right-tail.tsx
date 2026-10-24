'use client'

import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

const IconSvg = () => (
  <svg width="1em" height="1em" viewBox="0 0 18 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M16.6836 10.2148L12.9648 13.9336L12.5 14.3984L11.5977 13.4688L12.0625 13.0039L14.6602 10.4062H1.125V9.09375H14.6602L12.0625 6.49609L11.5977 6.03125L12.5 5.10156L12.9648 5.56641L16.6836 9.28516L17.1484 9.75L16.6836 10.2148Z"
      fill="currentColor"
    />
  </svg>
)

export const ArrowRightTailIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)
