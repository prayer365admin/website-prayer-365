'use client'
import s from './index.module.scss'
import { Layout } from 'antd'
import dayjs from 'dayjs'
const { Footer } = Layout

export default function MainFooter() {
  const currentYear = dayjs().year()
  return (
    <>
      <Footer className={`${s.footer} !h-[60px] !p-0 flex shrink-0 items-center justify-center`}>
        ©{currentYear} {process.env.NEXT_PUBLIC_COMPANY_NAME || 'Catalyst Inertia'}. All rights
        reserved.
      </Footer>
    </>
  )
}
