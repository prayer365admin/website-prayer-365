import ContentsResetPassword from '@/contents/reset-password'
import { Fragment, Suspense } from 'react'

export default function Page() {
  return (
    <Fragment>
      <Suspense fallback={null}>
        <ContentsResetPassword />
      </Suspense>
    </Fragment>
  )
}
