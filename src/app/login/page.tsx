import SignInForm from '@/components/auth/sign-in-form'

export default function Page() {
  return (
    <SignInForm
      brandTitle="PRAYER"
      welcome="Sign in to read and listen to today's prayers."
      redirectTo="/"
    />
  )
}
