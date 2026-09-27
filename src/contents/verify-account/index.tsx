'use client'

import { App, Button, Card, Result } from 'antd'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

const DEFAULT_COOLDOWN_SECONDS = 90

export default function ContentsVerifyAccount() {
  const router = useRouter()
  const { notification } = App.useApp()
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''
  const [sending, setSending] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const isCountdownActive = remainingSeconds > 0

  useEffect(() => {
    if (!isCountdownActive) return

    const timer = setInterval(() => {
      setRemainingSeconds((current) => {
        if (current <= 1) {
          clearInterval(timer)
          return 0
        }
        return current - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isCountdownActive])

  const handleSend = async () => {
    setSending(true)
    try {
      const res = await fetch('/api/v1/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email }),
      })
      const json = await res.json()

      if (!res.ok) {
        if (json.error_code === 'RESEND_TOO_EARLY') {
          const match = /remaining_seconds=(\d+)/.exec(json.details || '')
          setRemainingSeconds(match ? Number(match[1]) : DEFAULT_COOLDOWN_SECONDS)
          return notification.info({
            message: 'Please Wait',
            description: json.details || 'You can resend shortly.',
          })
        }
        if (json.error_code === 'ALREADY_VERIFIED') {
          notification.success({
            message: 'Already Verified!',
            description: 'Your email is already verified. Redirecting to login...',
          })
          return router.push('/login')
        }
        return notification.error({
          message: 'Failed to Send!',
          description: json.details || 'Please try again later.',
        })
      }

      setRemainingSeconds(json.result?.cooldown_seconds || DEFAULT_COOLDOWN_SECONDS)
      notification.success({
        message: 'Email Sent!',
        description: 'Verification email sent! Please check your inbox (and spam folder).',
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <div className="w-screen h-screen flex items-center justify-center">
        <Card className="w-[40%]">
          <Result
            status="warning"
            title="Your account is not yet verified"
            subTitle={
              <>
                We sent a verification link to <b>{email || 'your email'}</b>. Click the button
                below to (re)send it — and check your <b>spam / junk folder</b> if you don&apos;t
                see it. You can&apos;t login until your email is verified.
              </>
            }
            extra={[
              <Button
                type="primary"
                key="send"
                block
                loading={sending}
                disabled={!email || remainingSeconds > 0}
                onClick={handleSend}
              >
                {remainingSeconds > 0 ? `Resend in ${remainingSeconds}s` : 'Verify Now'}
              </Button>,
              <Link href="/login" key="login">
                <Button className="mt-2" block>
                  Back to Login
                </Button>
              </Link>,
            ]}
          />
        </Card>
      </div>
    </>
  )
}
