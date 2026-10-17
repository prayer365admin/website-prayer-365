import { UserOutlined } from '@/components/icon/antd-icons'
import { ReactNode } from 'react'

/** Overlapping placeholder member avatars (WB1 sign-in "Sanctuary Bell Reminder" style): 24px, 8px overlap, 2px white ring. */
export default function AvatarStack({
  count = 3,
  trailing,
}: {
  count?: number
  trailing?: ReactNode
}) {
  const circle =
    'flex h-6 w-6 items-center justify-center rounded-full text-xs shadow-[0px_0px_0px_2px_#FFFFFF] [&:not(:first-child)]:-ms-2'
  return (
    <span aria-hidden className="flex">
      {Array.from({ length: count }, (_, i) => (
        <span className={`${circle} bg-blue-800 text-white`} key={i}>
          <UserOutlined />
        </span>
      ))}
      {trailing && <span className={`${circle} bg-primary-150 text-primary-500`}>{trailing}</span>}
    </span>
  )
}
