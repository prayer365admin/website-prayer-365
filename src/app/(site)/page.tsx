import { auth } from '@/auth'

// Placeholder website home. WB-31 replaces the body with the getHome() prayer feed.
export default async function Page() {
  const session = await auth()

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-bold">PRAYER</h1>
      <p className="mt-2">
        Signed in as {session?.user?.name ?? session?.user?.email ?? 'customer'}.
      </p>
    </div>
  )
}
