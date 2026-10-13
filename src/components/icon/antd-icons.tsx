'use client'

// @ant-design/icons' entry calls createContext at import time and is not
// marked 'use client', so server components cannot import it directly.
// Re-export the built-in icons they need from here. Deep imports: the barrel
// is not tree-shaken across this client boundary (it would ship every icon).
export { default as CaretRightFilled } from '@ant-design/icons/es/icons/CaretRightFilled'
export { default as UserOutlined } from '@ant-design/icons/es/icons/UserOutlined'
