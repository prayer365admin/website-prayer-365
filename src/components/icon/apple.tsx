'use client'

import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

const IconSvg = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M17.05 12.536c-.03-3.133 2.558-4.657 2.676-4.727-1.466-2.137-3.74-2.429-4.545-2.452-1.912-.201-3.767 1.145-4.741 1.145-.993 0-2.492-1.125-4.108-1.092-2.08.032-4.027 1.237-5.094 3.104-2.203 3.815-.56 9.423 1.55 12.508 1.056 1.512 2.289 3.2 3.904 3.141 1.58-.065 2.17-1.01 4.078-1.01 1.89 0 2.444 1.01 4.091.972 1.696-.027 2.764-1.519 3.783-3.045 1.221-1.735 1.712-3.444 1.731-3.532-.04-.014-3.293-1.258-3.325-5.012ZM13.932 3.33C14.781 2.267 15.363.822 15.201-.645c-1.23.054-2.768.852-3.653 1.892-.783.918-1.482 2.419-1.3 3.83 1.382.104 2.774-.704 3.684-1.747Z"
      fill="currentColor"
    />
  </svg>
)

const CustomIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)

export { CustomIcon as AppleIcon }
