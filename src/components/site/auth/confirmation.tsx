import { CheckOutlined, CloseOutlined } from '@/components/icon/antd-icons'
import Link from 'next/link'
import { ReactNode } from 'react'

/*
 * Centered result block that replaces a form after it is sent (e.g. "Check
 * your email!"): status circle, title, text and one link. Success = green
 * check, error = red cross.
 */
export default function Confirmation({
  status = 'success',
  title,
  children,
  linkHref,
  linkLabel,
}: {
  status?: 'success' | 'error'
  title: string
  children: ReactNode
  linkHref: string
  linkLabel: string
}) {
  return (
    <div className="flex flex-col items-center py-4 text-center" role="status">
      <span
        aria-hidden
        className={`flex h-16 w-16 items-center justify-center rounded-full text-3xl text-white ${
          status === 'success' ? 'bg-success-500' : 'bg-danger-500'
        }`}
      >
        {status === 'success' ? <CheckOutlined /> : <CloseOutlined />}
      </span>
      <h2 className="mt-4 font-font_heading text-2xl font-semibold text-primary-900">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-neutral-600">{children}</p>
      <Link className="mt-6 text-sm font-semibold text-primary-500" href={linkHref}>
        {linkLabel}
      </Link>
    </div>
  )
}
