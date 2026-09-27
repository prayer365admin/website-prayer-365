'use client'

import { App, Button, Card, Form, Input, Result } from 'antd'
import Link from 'next/link'
import { useState } from 'react'

export default function ContentsForgotPassword() {
  const { notification } = App.useApp()
  const [forgotForm] = Form.useForm()
  const [sent, setSent] = useState(false)

  const handleSend = async () => {
    const payload = await forgotForm.validateFields()

    const res = await fetch('/api/v1/users/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: payload.email }),
    })
    const json = await res.json()

    if (!res.ok) {
      return notification.error({
        message: 'Request Failed!',
        description: json.details || 'Please try again later.',
      })
    }

    setSent(true)
  }

  if (sent) {
    return (
      <>
        <div className="w-screen h-screen flex items-center justify-center">
          <Card className="w-[40%]">
            <Result
              status="success"
              title="Check your email!"
              subTitle={
                <>
                  If the email is registered, we&apos;ve sent a <b>password reset link</b>. It
                  expires in <b>30 minutes</b>. Please check your inbox (and spam folder).
                </>
              }
            />
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

  return (
    <>
      <div className="w-screen h-screen flex items-center justify-center">
        <Card className="w-[40%]">
          <h1 className="text-2xl mb-3 text-center font-bold">Forgot Password</h1>
          <p className="text-center mb-6">
            Enter your email address and we&apos;ll send you a link to reset your password
          </p>
          <Form form={forgotForm} layout="vertical">
            <Form.Item
              name={'email'}
              rules={[
                { required: true, message: 'Please enter your email!' },
                { type: 'email', message: 'Email is invalid!' },
              ]}
            >
              <Input placeholder="Email" />
            </Form.Item>
          </Form>
          <Button className="w-full" type="primary" onClick={handleSend}>
            Send Reset Link
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
