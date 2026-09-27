'use client'

import dynamic from 'next/dynamic'
import { AnimatePresence, motion } from 'framer-motion'

const Lottie = dynamic(() => import('lottie-react').then((m) => m.Lottie), { ssr: false })
import animationData from '@/animation/splash-screen.json'
import { useEffect, useState } from 'react'

export default function SplashScreen() {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const timeout = setTimeout(() => {
      setIsLoading(false)
      document.body.style.overflow = 'auto'
    }, 1500)

    return () => {
      clearTimeout(timeout)
    }
  }, [])

  return (
    <>
      <AnimatePresence mode="wait">
        {isLoading && (
          <motion.div
            key={'animation'}
            className="fixed z-50 w-full h-full bg-black flex justify-center items-center"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Lottie src={animationData} className=" w-[350px]" loop />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
