'use client'

import { motion } from 'framer-motion'

export default function AnimateText() {
  return (
    <div className="overflow-hidden">
      <motion.div animate={{ x: 100 }}>Animate Text</motion.div>
    </div>
  )
}
