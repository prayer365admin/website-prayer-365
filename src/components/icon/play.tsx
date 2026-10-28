'use client'

import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

// Source: public/icons/icon-play-button.svg. The component box is 1em square;
// the original path supplies the intentionally narrower play glyph.
const IconSvg = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M6 17.7812V4.5L7.5 5.34375L17.9688 11.1562L19.5 12L17.9688 12.875L7.5 18.6562L6 19.5V17.7812ZM7.5 16.9375L16.4062 12L7.5 7.0625V16.9375Z"
      fill="currentColor"
    />
  </svg>
)

const CustomIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)

export { CustomIcon as PlayIcon }
