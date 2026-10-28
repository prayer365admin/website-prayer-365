'use client'

import type { ComponentProps } from 'react'

interface ChurchIconProps extends Omit<ComponentProps<'span'>, 'viewBox'> {
  /** Render the church glyph optically centered in its box (for pins/avatars); text-flow glyphs stay untouched. */
  centered?: boolean
  viewBox?: string
}

const CHURCH_PATH =
  'M7.65625 0V1.3125H9.1875V2.625H7.65625V3.80078L11.0742 6.01562L11.375 6.20703V7.49219L13.6719 8.83203L14 9.02344V14.875H0V9.02344L0.328125 8.83203L2.625 7.49219V6.20703L2.92578 6.01562L6.34375 3.80078V2.625H4.8125V1.3125H6.34375V0H7.65625ZM3.9375 7.875V13.5625H5.25V9.625H8.75V13.5625H10.0625V6.91797L7 4.94922L3.9375 6.91797V7.875ZM11.375 13.5625H12.6875V9.78906L11.375 9.02344V13.5625ZM2.625 9.02344L1.3125 9.78906V13.5625H2.625V9.02344Z'

export function ChurchIcon({ centered, viewBox, ...props }: ChurchIconProps) {
  return (
    <span {...props} className={`anticon ${props.className ?? ''}`.trim()}>
      <svg
        width="1em"
        height="1em"
        viewBox={viewBox ?? (centered ? '-1 0 16 15' : '0 0 14 15')}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d={CHURCH_PATH} fill="currentColor" />
      </svg>
    </span>
  )
}
