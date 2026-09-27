import ContentsVerifyAccount from '@/contents/verify-account'
import { Fragment, Suspense } from 'react'

export default function Page() {
  return (
    <Fragment>
      <Suspense fallback={null}>
        <ContentsVerifyAccount />
      </Suspense>
    </Fragment>
  )
}
