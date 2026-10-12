import SignInForm from '@/components/auth/sign-in-form'

export default function Page() {
  return (
    <SignInForm
      brandTitle="Prayer Dashboard"
      welcome="Sign in to the staff dashboard."
      redirectTo="/dashboard"
    />
  )
}
