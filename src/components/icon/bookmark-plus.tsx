import type { SVGProps } from 'react'

export interface BookmarkPlusIconProps extends SVGProps<SVGSVGElement> {
  className?: string
  filled?: boolean
}

export function BookmarkPlusIcon({ className, filled, ...props }: BookmarkPlusIconProps) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path
        d="M3.75 2.5C3.75 1.94772 4.19772 1.5 4.75 1.5H11.25C11.8023 1.5 12.25 1.94772 12.25 2.5V14.5L8 11.75L3.75 14.5V2.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={filled ? 'currentColor' : 'none'}
      />
      <path
        d="M8 4.75V8.25M6.25 6.5H9.75"
        stroke={filled ? '#FFFFFF' : 'currentColor'}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default BookmarkPlusIcon
