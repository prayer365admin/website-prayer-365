import { useRouter } from 'next/navigation'
import { Fragment } from 'react'
import { ArrowLeftOutlined } from '@ant-design/icons'

export default function CardTitle({ title }: { title: string }) {
  const router = useRouter()
  return (
    <Fragment>
      <div className="flex flex-wrap gap-2">
        <span className="flex items-center top-[2px] cursor-pointer" onClick={() => router.back()}>
          <ArrowLeftOutlined />
        </span>
        <h1 className="font-font_heading font-bold ">{title}</h1>
      </div>
    </Fragment>
  )
}
