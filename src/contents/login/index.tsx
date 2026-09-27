'use client'

import { App, Button, Card, Form, Input } from 'antd'
import { signIn, useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function ContentsLogin() {
  const router = useRouter()
  const { notification } = App.useApp()
  const [loginForm] = Form.useForm()
  const { data: session } = useSession()

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
          message: 'Password Invalid!',
          description: 'Please check your username and password, and try again!',
        })
      }
      if (result.code === 'EMAIL_NOT_VERIFIED') {
        return router.push(`/verify-account?email=${encodeURIComponent(payload.name)}`)
      }
      return notification.error({
        message: 'User Not Found!',
        description: 'Please check your username, and try again!',
      })
    }
  }

  useEffect(() => {
    if (session) {
      router.push('/dashboard')
    }
  }, [router, session])

  return (
    <>
      <div className="w-screen h-screen flex items-center justify-center">
        <Card className="w-[40%]">
          <h1 className="text-2xl mb-3 text-center font-bold">Login</h1>
          <p className="text-center mb-6">
            Welcome to <b>Catatia Back Office</b> <br /> Please enter your username to log in and
            get started
          </p>
          <Form form={loginForm} layout="vertical">
            <Form.Item name={'name'}>
              <Input placeholder="Username" />
            </Form.Item>
            <Form.Item name={'password'}>
              <Input.Password placeholder="Password" />
            </Form.Item>
          </Form>
          <Button className="w-full" type="primary" onClick={handleLogin}>
            Login
          </Button>
          <p className="text-right mt-2">
            <Link className="text-blue-500 text-sm" href="/forgot-password">
              Forgot password?
            </Link>
          </p>
          <p className="text-center mt-2">
            Don&apos;t have an account?{' '}
            <Link className="text-blue-500" href="/register">
              Register
            </Link>
          </p>
        </Card>
      </div>
    </>
  )
}
