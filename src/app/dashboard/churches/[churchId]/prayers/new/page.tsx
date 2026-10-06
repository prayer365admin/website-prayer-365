import ContentsChurchesPrayersEditor from '@/contents/churches/prayers/editor'
import { Fragment } from 'react'

export default async function Page({ params }: { params: Promise<{ churchId: string }> }) {
  const { churchId } = await params
  return (
    <Fragment>
      <ContentsChurchesPrayersEditor churchId={churchId} />
    </Fragment>
  )
}
