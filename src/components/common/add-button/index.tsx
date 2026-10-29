import { useAccessPermission } from '@/hooks/data/access-permission'
import { PlusCircleFilled } from '@ant-design/icons'
import { Button } from 'antd'
import { useState } from 'react'

export default function AddButton({
  label,
  onClick,
  permissionSubject,
  disabled,
  loading: loadingProp,
  className,
}: {
  label: string
  onClick?: () => void | Promise<unknown>
  permissionSubject?: string
  disabled?: boolean
  loading?: boolean
  className?: string
}) {
  const [loading, setLoading] = useState<boolean>(false)

  const permission = useAccessPermission()
  const havePermission = permissionSubject
    ? permission.createAny(permissionSubject).granted ||
      permission.createOwn(permissionSubject).granted
    : true

  const handleClick = async () => {
    if (!onClick) return
    const res = onClick() as unknown
    if (res && typeof (res as Promise<unknown>).then === 'function') {
      setLoading(true)
      try {
        await res
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    havePermission && (
      <div className={className ?? 'w-full mb-5 flex items-center justify-end'}>
        <Button
          type="primary"
          icon={<PlusCircleFilled />}
          size="large"
          onClick={handleClick}
          loading={loadingProp ?? loading}
          disabled={disabled}
        >
          {label}
        </Button>
      </div>
    )
  )
}
