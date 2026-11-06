import type { CSSProperties, HTMLAttributes } from 'react'

const iconSources = {
  angleRight: '/icons/icon-angle-right.svg',
  announcement: '/icons/Icon-announcement.svg',
  arrowRightTail: '/icons/icon-arrow-right-tail.svg',
  back: '/icons/Icon-back.svg',
  bell: '/icons/Icon-bell.svg',
  church: '/icons/icon-church.svg',
  customers: '/icons/Icon-customers.svg',
  dashboard: '/icons/Icon-dashboard.svg',
  earth: '/icons/Icon-earth.svg',
  eye: '/icons/Icon-eye-outlined.svg',
  handsPraying: '/icons/icon-hands-praying.svg',
  home: '/icons/icon-home.svg',
  information: '/icons/Icon-information.svg',
  language: '/icons/Icon-language.svg',
  microphone: '/icons/Icon-mic.svg',
  pastor: '/icons/Icon-pastor.svg',
  smile: '/icons/Icon-smile.svg',
  user: '/icons/Icon-user.svg',
  userSettings: '/icons/Icon-user-settings.svg',
  verified: '/icons/icon-verified.svg',
  users: '/icons/icon-users-2.svg',
  usersSolid: '/icons/icon-users.svg',
  hierarchy: '/icons/icon-users-3.svg',
} as const

export type LayoutIconName = keyof typeof iconSources

const glyphSizes: Partial<Record<LayoutIconName, number>> = {
  back: 20,
  home: 15,
  information: 20,
  user: 20,
}

type LayoutIconProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
  name: LayoutIconName
  /** Glyph height in px; overrides the per-name default (24). */
  size?: number
}

export default function LayoutIcon({
  name,
  size,
  className = '',
  style,
  ...props
}: LayoutIconProps) {
  const source = `url("${iconSources[name]}")`
  const glyphSize = size ?? glyphSizes[name] ?? 24
  const iconStyle: CSSProperties = {
    backgroundColor: 'currentColor',
    height: glyphSize,
    maskImage: source,
    WebkitMaskImage: source,
    maskPosition: 'center',
    WebkitMaskPosition: 'center',
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
    maskSize: 'contain',
    WebkitMaskSize: 'contain',
    width: glyphSize,
  }

  return (
    <span {...props} aria-hidden="true" className={`layout-icon ${className}`.trim()} style={style}>
      <span className="layout-icon__glyph" style={iconStyle} />
    </span>
  )
}
