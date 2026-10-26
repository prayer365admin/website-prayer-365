import { ShieldCheckIcon } from '@/components/icon/shield-check'
import type { ReactNode } from 'react'

const DEFAULT_NOTICE =
  'This system is strictly restricted to authorized clergy, church administrators, and diocesan staff. All access sessions are cryptographically audited and guarded under ecclesiastical safeguarding protocols.'

/** Staff auth card audit notice; screens that show another disclaimer pass it as children. */
export default function AuditNotice({ children }: { children?: ReactNode }) {
  return (
    <div className="flex gap-2 rounded-2xl bg-[#F5F7FF] p-3">
      <ShieldCheckIcon
        aria-hidden
        className="mt-0.5 shrink-0 text-[#204B92]"
        style={{ fontSize: 12 }}
      />
      <p className="text-xs leading-[1.5] text-[#434655]">{children ?? DEFAULT_NOTICE}</p>
    </div>
  )
}
