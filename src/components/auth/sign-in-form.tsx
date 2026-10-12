'use client'

import { App, Button, Card, Form, Input } from 'antd'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// Shared credentials form behind both the customer (/login) and staff
// (/admin/login) sign-in pages. Everything is parameterized; copy is plain
// English for the foundation (the customer copy moves to i18n in WB-11).
export default function SignInForm({
  brandTitle,
  welcome,
  redirectTo,
}: {
  brandTitle: string
  welcome: string
  redirectTo: string
}) {
  const router = useRouter()
  const { notification } = App.useApp()
  const [loginForm] = Form.useForm()

  const handleLogin = async () => {
    const payload = await loginForm.validateFields()
    const result = await signIn('credentials', {
      name: payload.name,
      password: payload.password,
      redirect: false,
    })

    if (result?.error) {
      if (result.code === 'PASSWORD_INVALID') {
        return notification.error({
          message: 'Password invalid',
          description: 'Please check your email and password, and try again!',
        })
      }
      if (result.code === 'EMAIL_NOT_VERIFIED') {
        return router.push(`/verify-account?email=${encodeURIComponent(payload.name)}`)
      }
      return notification.error({
        message: 'Sign in failed',
        description: 'Please check your email, and try again!',
      })
    }

    router.push(redirectTo)
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <Card className="w-[40%]">
        <h1 className="mb-3 text-center text-2xl font-bold">{brandTitle}</h1>
        <p className="mb-6 text-center">{welcome}</p>
        <Form form={loginForm} layout="vertical">
          <Form.Item name={'name'}>
            <Input placeholder="Email" />
          </Form.Item>
          <Form.Item name={'password'}>
            <Input.Password placeholder="Password" />
          </Form.Item>
        </Form>
        <Button className="w-full" type="primary" onClick={handleLogin}>
          Sign in
        </Button>
        <p className="mt-2 text-right">
          <Link className="text-blue-500 text-sm" href="/forgot-password">
            Forgot password?
          </Link>
        </p>
      </Card>
    </div>
  )
}
