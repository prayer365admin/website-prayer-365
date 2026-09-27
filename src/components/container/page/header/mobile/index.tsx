import BoxContainer from '@/components/container/boxed'
import { BurgerMenuIcon } from '@/components/icon/burger-menu'
import { PageNavigationData } from '@/data/page-navigation'
import { SocialMediaFooterData } from '@/data/social-media-footer'
import { useScrollDetection } from '@/hooks/ui/scroll-detection'
import { CloseCircleOutlined } from '@ant-design/icons'
import { AnimatePresence, motion } from 'framer-motion'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import s from './index.module.scss'

export default function ContainerPageHeaderMobile() {
  const router = useRouter()

  const [openMenu, setOpenMenu] = useState(false)

  const { isVisible, withBackground } = useScrollDetection()

  useEffect(() => {
    if (openMenu) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'auto'
    }
  }, [openMenu])

  return (
    <>
      <AnimatePresence key={'header-animation'} mode="sync">
        <motion.header
          className={`fixed w-full top-0 z-50 transition-[background] ${withBackground ? 'bg-black_color drop-shadow-lg' : 'bg-transparent'} min-h-[80px] flex items-center`}
          initial={{ y: 0 }}
          animate={{ y: isVisible ? 0 : -100 }}
          transition={{ duration: 0.3, bounce: false }}
        >
          <BoxContainer sectionClassName="w-full">
            <div className="flex flex-wrap justify-between items-center min-h-[85px]">
              <div
                className="w-[80px] aspect-video relative cursor-pointer"
                onClick={() => {
                  router.push('/')
                  setOpenMenu(false)
                }}
              >
                <Image src={'/images/logo.png'} fill alt="logo" style={{ objectFit: 'contain' }} />
              </div>
              <div
                className="flex flex-wrap gap-10"
                onClick={() => {
                  setOpenMenu(!openMenu)
                }}
              >
                <BurgerMenuIcon className={s.icon} />
              </div>
            </div>
          </BoxContainer>
        </motion.header>
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {openMenu && (
          <div className={`fixed w-full h-screen z-50 flex justify-end bg-black_color`}>
            <motion.div
              initial={{ x: 400 }}
              animate={{ x: 0 }}
              exit={{ x: 400 }}
              transition={{ duration: 0.3, bounce: true }}
              className={`w-screen h-screen right-0 relative z-10 flex flex-wrap items-between px-[25px] ${s.slider}`}
            >
              <div className="w-full z-10 flex flex-wrap">
                <div className="w-full">
                  <div className="min-h-[80px] flex items-center justify-between mb-8 w-full">
                    <div
                      className="w-[80px] aspect-video relative cursor-pointer"
                      onClick={() => {
                        router.push('/')
                        setOpenMenu(false)
                      }}
                    >
                      <Image
                        src={'/images/logo.png'}
                        fill
                        alt="logo"
                        style={{ objectFit: 'contain' }}
                      />
                    </div>
                    <div
                      onClick={() => {
                        setOpenMenu(false)
                      }}
                      className="text-[28px]"
                    >
                      <CloseCircleOutlined />
                    </div>
                  </div>
                  <div className="w-full">
                    {PageNavigationData.map((item) => {
                      return (
                        <div
                          key={item.key}
                          onClick={() => {
                            router.push(item.url, { scroll: true })
                            setOpenMenu(false)
                          }}
                          className={`text-[24px] font-bold mb-6 relative w-fit pb-1`}
                        >
                          {item.label}
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div className="w-full self-end pb-6">
                  <div className="flex flex-wrap justify-between pt-[180px]">
                    <div className="w-full lg:w-fit mb-6 lg:mb-0 ">
                      <div className="text-[18px]">© Outlet23 All rights reserved.</div>
                    </div>
                    <div className="flex flex-wrap gap-8">
                      {SocialMediaFooterData.map((item) => (
                        <div key={item.key}>
                          <a href={item.url} target="_blank">
                            {item.icon}
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
