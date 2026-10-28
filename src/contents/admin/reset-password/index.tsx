import type { Metadata } from 'next'
import AuditNotice from '@/contents/admin/sign-in/audit-notice'
import { Suspense } from 'react'
import ResetPasswordForm from './form'

export const metadata: Metadata = { title: 'Reset Password - PRAYER 365 Admin Suite' }

export default function ContentsAdminResetPassword() {
  return (
    <main className="flex min-h-screen bg-[#F6F8FC]">
      <div className="mx-auto flex w-full max-w-[512px] flex-col gap-4 px-6 py-12 sm:px-8">
        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>
        <AuditNotice />
      </div>
    </main>
  )
}
