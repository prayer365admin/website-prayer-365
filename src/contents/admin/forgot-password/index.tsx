import type { Metadata } from 'next'
import ForgotPasswordForm from './form'

export const metadata: Metadata = { title: 'Forgot Password - PRAYER 365 Admin Suite' }

export default function ContentsAdminForgotPassword() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F6F8FC] p-6 sm:p-8">
      <div className="my-auto w-full max-w-[512px]">
        <ForgotPasswordForm />
      </div>
    </main>
  )
}
