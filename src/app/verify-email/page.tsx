import ContentsVerifyEmail from '@/contents/verify-email'
import { Fragment, Suspense } from 'react'

export default function Page() {
  return (
    <Fragment>
      <Suspense fallback={null}>
        <ContentsVerifyEmail />
      </Suspense>
    </Fragment>
  )
}
