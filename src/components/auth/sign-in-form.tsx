'use client'

import { App, Button, Card, Form, Input } from 'antd'
import { useCredentialsSignIn } from '@/hooks/ui/credentials-sign-in'
import Link from 'next/link'

// Plain credentials form for the staff /admin/login page. Copy is plain
// English. The customer /login has its own designed screen
// (contents/site/sign-in) on the same useCredentialsSignIn hook.
export default function SignInForm({
  brandTitle,
  welcome,
  redirectTo,
}: {
  brandTitle: string
  welcome: string
  redirectTo: string
}) {
  const { notification } = App.useApp()
  const [loginForm] = Form.useForm()
  const { onSignIn } = useCredentialsSignIn(redirectTo)

  const handleLogin = async () => {
    const payload = await loginForm.validateFields()
    const code = await onSignIn({ email: payload.name, password: payload.password })

    if (code === 'INVALID_CREDENTIALS' || code === 'PASSWORD_INVALID') {
      return notification.error({
        message: 'Password invalid',
        description: 'Please check your email and password, and try again!',
      })
    }
    if (code) {
      return notification.error({
        message: 'Sign in failed',
        description: 'Please check your email, and try again!',
      })
    }
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
