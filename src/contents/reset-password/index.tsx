'use client'

import { App, Button, Card, Form, Input, Result } from 'antd'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

export default function ContentsResetPassword() {
  const router = useRouter()
  const { notification } = App.useApp()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [resetForm] = Form.useForm()
  const [done, setDone] = useState(false)

  const handleReset = async () => {
    const payload = await resetForm.validateFields()

    const res = await fetch('/api/v1/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: token,
        new_password: payload.password,
        confirm_password: payload.confirm_password,
      }),
    })
    const json = await res.json()

    if (!res.ok) {
      return notification.error({
        message: 'Reset Failed!',
        description: json.details || 'Please try again later.',
      })
    }

    notification.success({
      message: 'Password Reset!',
      description: 'Your password has been changed. Redirecting to login...',
    })
    setDone(true)
    router.push('/login')
  }

  if (!token) {
    return (
      <>
        <div className="w-screen h-screen flex items-center justify-center">
          <Card className="w-[40%]">
            <Result
              status="error"
              title="Invalid Reset Link"
              subTitle={
                <>
                  The reset link is missing or malformed. Please check your email or request a new
                  one.
                </>
              }
              extra={
                <Link className="text-blue-500" href="/forgot-password">
                  Request a new reset link
                </Link>
              }
            />
          </Card>
        </div>
      </>
    )
  }

  if (done) {
    return (
      <>
        <div className="w-screen h-screen flex items-center justify-center">
          <Card className="w-[40%]">
            <Result
              status="success"
              title="Password Changed!"
              subTitle={
                <>
                  Your password has been <b>successfully reset</b>. Redirecting to login...
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
          <h1 className="text-2xl mb-3 text-center font-bold">Reset Password</h1>
          <p className="text-center mb-6">Enter your new password below</p>
          <Form form={resetForm} layout="vertical">
            <Form.Item
              name={'password'}
              rules={[
                { required: true, message: 'Please enter a new password!' },
                { min: 8, message: 'Password must be at least 8 characters!' },
              ]}
            >
              <Input.Password placeholder="New Password" />
            </Form.Item>
            <Form.Item
              name={'confirm_password'}
              dependencies={['password']}
              rules={[
                { required: true, message: 'Please confirm your new password!' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve()
                    }
                    return Promise.reject(new Error('Passwords do not match!'))
                  },
                }),
              ]}
            >
              <Input.Password placeholder="Confirm New Password" />
            </Form.Item>
          </Form>
          <Button className="w-full" type="primary" onClick={handleReset}>
            Reset Password
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
