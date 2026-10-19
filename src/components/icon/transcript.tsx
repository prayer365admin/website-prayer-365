import type { SVGProps } from 'react'

export interface TranscriptIconProps extends SVGProps<SVGSVGElement> {
  className?: string
}

export function TranscriptIcon({ className, ...props }: TranscriptIconProps) {
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
        d="M3 3.75H9M3 7.25H13M3 10.75H8.5M3 14.25H13"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default TranscriptIcon
