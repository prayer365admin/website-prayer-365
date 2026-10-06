import { useAccessPermission } from '@/hooks/data/access-permission'
import { PlusCircleFilled } from '@ant-design/icons'
import { Button } from 'antd'
import { useState } from 'react'

export default function AddButton({
  label,
  onClick,
  permissionSubject,
  disabled,
}: {
  label: string
  onClick?: () => void
  permissionSubject?: string
  disabled?: boolean
}) {
  const [loading, setLoading] = useState<boolean>(false)

  const permission = useAccessPermission()
  const havePermission = permissionSubject
    ? permission.createAny(permissionSubject).granted ||
      permission.createOwn(permissionSubject).granted
    : true

  const handleClick = () => {
    onClick?.()
    setLoading(true)
  }

  return (
    havePermission && (
      <div className="w-full mb-5 flex items-center justify-end">
        <Button
          type="primary"
          icon={<PlusCircleFilled />}
          size="large"
          onClick={handleClick}
          loading={loading}
          disabled={disabled}
        >
          {label}
        </Button>
      </div>
    )
  )
}
