'use client'

import { LoadingOutlined } from '@ant-design/icons'
import { ButtonHTMLAttributes, ReactNode } from 'react'

export type SiteButtonVariant = 'solid' | 'outlined'
export type SiteButtonSize = 'lg' | 'md' | 'sm' | 'xs'

/*
 * Website button (WB1 design). A native <button> rather than antd Button:
 * the design needs four sizes and its own hover / pressed / disabled colors,
 * which antd only allows with !important overrides on every state.
 */

const base =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border font-font_text font-semibold leading-[1.5] tracking-normal transition-colors duration-300 ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 ' +
  'disabled:cursor-not-allowed'

const variants: Record<SiteButtonVariant, string> = {
  solid:
    'border-primary-600 bg-primary-500 text-white ' +
    'enabled:hover:border-primary-700 enabled:hover:bg-primary-700 ' +
    'enabled:active:border-primary-300 enabled:active:bg-primary-300 ' +
    'disabled:border-neutral-200 disabled:bg-neutral-200',
  outlined:
    'border-primary-500 bg-white text-primary-500 ' +
    'enabled:hover:bg-primary-500 enabled:hover:text-white ' +
    'enabled:active:border-primary-300 enabled:active:bg-primary-300 enabled:active:text-white ' +
    'disabled:border-neutral-200 disabled:text-neutral-200',
}

// Heights 56 / 48 / 40 / 32, text 16 / 16 / 14 / 12 (Body font, semibold, 150%).
// lg keeps the design's 11px top / 13px bottom padding.
const sizes: Record<SiteButtonSize, string> = {
  lg: 'h-14 px-6 pb-[13px] pt-[11px] text-base',
  md: 'h-12 px-6 text-base',
  sm: 'h-10 px-4 text-sm',
  xs: 'h-8 px-3 text-xs',
}

export default function SiteButton({
  variant = 'solid',
  size = 'lg',
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
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
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
