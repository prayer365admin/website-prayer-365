'use client'

import { LoadingOutlined } from '@ant-design/icons'
import { ButtonHTMLAttributes, ReactNode } from 'react'
import { siteButtonClassName, type SiteButtonSize, type SiteButtonVariant } from './classes'

export { siteButtonClassName }
export type { SiteButtonSize, SiteButtonVariant } from './classes'

export default function SiteButton({
  variant = 'solid',
  size = 'lg',
  desktopSize,
  icon,
  iconPlacement = 'start',
  loading = false,
  disabled,
  type = 'button',
  className = '',
  children,
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  variant?: SiteButtonVariant
  size?: SiteButtonSize
  /** Size from 768px up; `size` then applies to phones only. */
  desktopSize?: SiteButtonSize
  icon?: ReactNode
  iconPlacement?: 'start' | 'end'
  loading?: boolean
  type?: 'button' | 'submit' | 'reset'
}) {
  // While loading the spinner replaces the icon and the button cannot be pressed again.
  const shownIcon = loading ? <LoadingOutlined aria-hidden /> : icon

  return (
    <button
      aria-busy={loading || undefined}
      className={siteButtonClassName({ variant, size, desktopSize, className })}
      disabled={disabled || loading}
      type={type}
      {...rest}
    >
      {iconPlacement === 'start' && shownIcon}
      {children}
      {iconPlacement === 'end' && shownIcon}
    </button>
  )
}
