'use client'

import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

const IconSvg = () => (
  <>
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M13 1H5C2.79086 1 1 2.79086 1 5V13C1 15.2091 2.79086 17 5 17H13C15.2091 17 17 15.2091 17 13V5C17 2.79086 15.2091 1 13 1Z"
        stroke="#F9F9F9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.2 8.496C12.2987 9.16179 12.185 9.84177 11.875 10.4392C11.565 11.0366 11.0745 11.5211 10.4733 11.8237C9.87207 12.1263 9.19074 12.2317 8.52621 12.1247C7.86169 12.0178 7.24779 11.7041 6.77186 11.2281C6.29592 10.7522 5.98217 10.1383 5.87524 9.47377C5.76831 8.80924 5.87364 8.12791 6.17625 7.5267C6.47886 6.92548 6.96333 6.43499 7.56077 6.12499C8.15821 5.81499 8.83819 5.70127 9.50399 5.8C10.1831 5.9007 10.8119 6.21717 11.2973 6.70264C11.7828 7.18812 12.0993 7.81686 12.2 8.496Z"
        stroke="#F9F9F9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="13.8" cy="4.20015" r="0.8" fill="#F9F9F9" stroke="#F9F9F9" strokeWidth="0.5" />
    </svg>
  </>
)

const CustomIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)

export { CustomIcon as InstagramIcon }
