'use client'

import useScreenSize from '@/hooks/ui/screen-size'
import ContainerPageHeaderDesktop from './desktop'
import ContainerPageHeaderMobile from './mobile'

export default function ContainerPageHeader() {
  const { isMobile } = useScreenSize()

  return (
    <>
      {!isMobile && <ContainerPageHeaderDesktop />}
      {isMobile && <ContainerPageHeaderMobile />}
    </>
  )
}
