'use client'

import { App, Button, Card, Result } from 'antd'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function ContentsVerifyEmail() {
  const router = useRouter()
  const { notification } = App.useApp()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [verified, setVerified] = useState(false)
  const [redirectIn, setRedirectIn] = useState(3)

  useEffect(() => {
    if (!verified) return

    const timer = setInterval(() => {
      setRedirectIn((current) => {
        if (current <= 1) {
          clearInterval(timer)
          router.push('/login')
          return 0
        }
        return current - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [verified, router])

  const handleVerify = async () => {
    if (!token) {
      return notification.error({
        message: 'Invalid Link!',
        description: 'The verification link is missing or malformed. Please check your email.',
      })
    }

    const res = await fetch('/api/v1/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token }),
    })
    const json = await res.json()

    if (!res.ok) {
      return notification.error({
        message: 'Verification Failed!',
        description: json.details || 'Please try again later.',
      })
    }

    setVerified(true)
  }

  if (verified) {
    return (
      <>
        <div className="w-screen h-screen flex items-center justify-center">
          <Card className="w-[40%]">
            <Result
              status="success"
              title="Congratulations!"
              subTitle={
                <>
                  Your account has been <b>successfully verified</b>. Redirecting to login in{' '}
                  <b>{redirectIn}s</b>...
                </>
              }
            />
          </Card>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="w-screen h-screen flex items-center justify-center">
        <Card className="w-[40%]">
          <h1 className="text-2xl mb-3 text-center font-bold">Verify Your Email</h1>
          <p className="text-center mb-6">
            Click the button below to confirm your email address and activate your account
          </p>
          <Button className="w-full" type="primary" onClick={handleVerify}>
            Confirm Email
          </Button>
          <p className="text-center mt-4">
            <Link className="text-blue-500" href="/login">
              Back to Login
            </Link>
          </p>
        </Card>
      </div>
    </>
  )
}
