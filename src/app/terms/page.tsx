import { redirect } from 'next/navigation'

/*
 * The footer's "Terms of Fellowship" label has always pointed at /terms. The
 * Terms & Conditions now live on /privacy with an in-page anchor, so this route
 * only forwards — bookmarks and the footer link keep working.
 */
export default function Page() {
  redirect('/privacy#terms')
}
