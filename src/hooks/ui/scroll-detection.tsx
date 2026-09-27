import { useMotionValueEvent, useScroll } from 'framer-motion'
import { useState } from 'react'

export const useScrollDetection = () => {
  const { scrollY } = useScroll()
  const [isVisible, setIsVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)
  const [withBackground, setWithBackground] = useState(false)

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setLastScrollY(latest)

    if (latest > lastScrollY) {
      setIsVisible(false)
    }

    if (latest < lastScrollY) {
      setIsVisible(true)
    }

    if (latest !== 0 && isVisible) {
      setWithBackground(true)
    } else {
      setWithBackground(false)
    }
  })

  return {
    withBackground,
    isVisible,
  }
}
