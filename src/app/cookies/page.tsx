import { redirect } from 'next/navigation'

/* Cookie Policy is a section of /privacy; /cookies is a stable short link to it. */
export default function Page() {
  redirect('/privacy#cookies')
}
