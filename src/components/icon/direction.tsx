'use client'

import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

const IconSvg = () => (
  <svg width="1em" height="1em" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M2.5625 9.75L3.49219 8.82031L9.07031 3.24219L10 2.3125L10.9297 3.24219L16.5078 8.82031L17.4375 9.75L16.5078 10.6797L10.9297 16.2578L10 17.1875L9.07031 16.2578L3.49219 10.6797L2.5625 9.75ZM10 15.3281L15.5781 9.75L10 4.17188L4.42188 9.75L10 15.3281ZM12.8711 9.77734C11.5039 11.1445 10.7656 11.8828 10.6562 11.9922L9.72656 11.0625C10 10.7891 10.3828 10.4062 10.8203 9.96875H8.6875V11.9375H7.375V8.65625H10.8203C10.3828 8.21875 10 7.83594 9.72656 7.5625L10.6562 6.63281L11.1211 7.09766C12.5156 8.49219 13.2539 9.23047 13.3359 9.3125L12.8711 9.77734Z"
      fill="currentColor"
    />
  </svg>
)

const CustomIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)

export { CustomIcon as DirectionIcon }
