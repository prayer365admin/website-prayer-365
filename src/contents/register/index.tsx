'use client'

import { App, Button, Card, Form, Input, Result } from 'antd'
import Link from 'next/link'
import { useState } from 'react'

export default function ContentsRegister() {
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null)
  const { notification } = App.useApp()
  const [registerForm] = Form.useForm()

  const handleRegister = async () => {
    const payload = await registerForm.validateFields()

    const res = await fetch('/api/v1/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()

    if (!res.ok) {
      return notification.error({
        message: 'Registration Failed!',
        description:
          json.error_code === 'USER_EXISTS'
            ? 'Email already registered. Please login instead.'
            : json.details || 'Please try again later.',
      })
    }

    setRegisteredEmail(json.result?.email || payload.email)
  }

  if (registeredEmail) {
    return (
      <>
        <div className="w-screen h-screen flex items-center justify-center">
          <Card className="w-[40%]">
            <Result
              status="success"
              title="Check your email!"
              subTitle={
                <>
                  We sent a verification link to <b>{registeredEmail}</b>. Click it to activate your
                  account — and check your <b>spam / junk folder</b> if you don&apos;t see it within
                  a few minutes.
                </>
              }
              extra={[
                <Link href="/login" key="login">
                  <Button type="primary">Back to Login</Button>
                </Link>,
              ]}
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
          <h1 className="text-2xl mb-3 text-center font-bold">Register</h1>
          <p className="text-center mb-6">
            Create your <b>Catatia Back Office</b> account <br /> An email verification link will be
            sent to your inbox
          </p>
          <Form form={registerForm} layout="vertical">
            <Form.Item
              name="full_name"
              rules={[{ required: true, message: 'Please input your full name!' }]}
            >
              <Input placeholder="Full Name" />
            </Form.Item>
            <Form.Item
              name="email"
              rules={[
                { required: true, message: 'Please input your email!' },
                { type: 'email', message: 'Email is invalid!' },
              ]}
            >
              <Input placeholder="Email" />
            </Form.Item>
            <Form.Item
              name="password"
              rules={[
                { required: true, message: 'Please input your password!' },
                { min: 8, message: 'Password must be at least 8 characters!' },
              ]}
            >
              <Input.Password placeholder="Password" />
            </Form.Item>
            <Form.Item
              name="confirm_password"
              dependencies={['password']}
              rules={[
                { required: true, message: 'Please confirm your password!' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve()
                    }
                    return Promise.reject(new Error('The two passwords do not match!'))
                  },
                }),
              ]}
            >
              <Input.Password placeholder="Confirm Password" />
            </Form.Item>
          </Form>
          <Button className="w-full" type="primary" onClick={handleRegister}>
            Register
          </Button>
          <p className="text-center mt-4">
            Already have an account?{' '}
            <Link className="text-blue-500" href="/login">
              Login
            </Link>
          </p>
        </Card>
      </div>
    </>
  )
}
