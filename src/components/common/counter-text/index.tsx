'use client'

import { animate, useInView } from 'framer-motion'
import React, { useEffect, useLayoutEffect, useRef } from 'react'

export default function Counter({ from, to }: { from: number; to: number }) {
  const nodeRef = useRef<HTMLDivElement>(null)
  const isInView = useInView(nodeRef, { once: false })

  useLayoutEffect(() => {
    if (nodeRef.current) {
      nodeRef.current.textContent = from.toFixed(0)
    }
  }, [from])

  useEffect(() => {
    if (isInView) {
      const node = nodeRef.current
      const controls = animate(from, to, {
        duration: 1,
        onUpdate(value) {
          if (node) {
            node.textContent = value.toFixed(0)
          }
        },
      })

      return () => controls.stop()
    }
  }, [from, to, isInView])

  return (
    <div ref={nodeRef} className={`text-xl lg:text-3xl font-bold mb-4`}>
      {from.toFixed(0)}
    </div>
  )
}
