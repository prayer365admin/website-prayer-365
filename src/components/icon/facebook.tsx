'use client'

import React from 'react'
import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

const IconSvg = () => (
  <>
    <svg width="11" height="20" viewBox="0 0 11 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M7 11H6.5V11.5V19.5H3.5V11.5V11H3H0.5V8H3H3.5V7.5V4.7C3.5 3.28717 3.94474 2.25152 4.65103 1.56823C5.36031 0.882049 6.38642 0.5 7.643 0.5C8.57438 0.5 9.46626 0.550651 10 0.593541V3H9C7.93928 3 7.22473 3.25611 6.83527 3.83447C6.65158 4.10724 6.57252 4.40857 6.53558 4.68727C6.49996 4.95603 6.49998 5.23775 6.5 5.48427L6.5 5.5V7.5V8H7H9.85961L9.10961 11H7Z"
        stroke="#F9F9F9"
      />
    </svg>
  </>
)

const CustomIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)

export { CustomIcon as FacebookIcon }
