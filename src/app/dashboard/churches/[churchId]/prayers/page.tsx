import ContentsChurchesPrayers from '@/contents/churches/prayers'
import { Fragment } from 'react'

export default async function Page({ params }: { params: Promise<{ churchId: string }> }) {
  const { churchId } = await params
  return (
    <Fragment>
      <ContentsChurchesPrayers churchId={churchId} />
    </Fragment>
  )
}
