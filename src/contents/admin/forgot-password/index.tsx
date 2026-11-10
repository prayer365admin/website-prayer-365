import type { Metadata } from 'next'
import { ADMIN_SUITE_NAME } from '@/config/site-brand'
import ForgotPasswordForm from './form'

export const metadata: Metadata = {
  title: `Forgot Password — ${ADMIN_SUITE_NAME}`,
  robots: { index: false, follow: false },
}

export default function ContentsAdminForgotPassword() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F6F8FC] px-4 py-8 sm:px-6 sm:py-12">
      <div className="my-auto w-full max-w-[512px]">
        <ForgotPasswordForm />
      </div>
    </main>
  )
}
