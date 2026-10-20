'use client'

import SiteButton from '@/components/common/button'
import { AppleIcon } from '@/components/icon/apple'
import { GoogleIcon } from '@/components/icon/google'
import { App } from 'antd'
import { signIn } from 'next-auth/react'
import { useState } from 'react'

export default function OAuthButtons({
  appleLabel,
  googleLabel,
}: {
  appleLabel: string
  googleLabel: string
}) {
  const { message } = App.useApp()
  const [googleLoading, setGoogleLoading] = useState(false)

  const continueWithGoogle = async () => {
    setGoogleLoading(true)
    try {
      await signIn('google', { redirectTo: '/customer/setup' })
    } catch {
      message.error('Google authentication could not be started. Please try again.')
      setGoogleLoading(false)
    }
  }

  return (
    <>
      <SiteButton
        className="w-full"
        disabled
        icon={<AppleIcon aria-hidden style={{ fontSize: 20 }} />}
        size="sm"
        variant="outlined"
      >
        {appleLabel}
      </SiteButton>
      <SiteButton
        className="w-full"
        icon={<GoogleIcon aria-hidden style={{ fontSize: 20 }} />}
        loading={googleLoading}
        onClick={continueWithGoogle}
        size="sm"
        variant="outlined"
      >
        {googleLabel}
      </SiteButton>
    </>
  )
}
