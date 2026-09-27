import { ReactNode } from 'react'
import ContainerPageHeader from './header'
import ContainerPageFooter from './footer'
import { Layout } from 'antd'
import SplashScreen from '@/components/common/splash-screen'

export default function ContainerPage({ children }: { children: ReactNode }) {
  const theme =
    process.env.NEXT_PUBLIC_THEME === 'black'
      ? '!bg-black_color !text-white_color'
      : '!bg-white_color !text-black_color'

  return (
    <>
      <Layout className={`!min-h-screen ${theme}`}>
        <ContainerPageHeader />
        <SplashScreen />
        <div className="min-h-[25vh]">{children}</div>
        <ContainerPageFooter />
      </Layout>
    </>
  )
}
