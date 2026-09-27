'use client'

import 'swagger-ui-react/swagger-ui.css'
import dynamic from 'next/dynamic'
import { type JSX } from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SwaggerUI = dynamic(() => import('swagger-ui-react').then((m) => m.default as any), {
  ssr: false,
}) as unknown as (props: { url: string }) => JSX.Element

export default function ApiDocsPage() {
  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-semibold">PRAYER API Documentation</h1>
      <SwaggerUI url="/api/v1/openapi.json" />
    </div>
  )
}
