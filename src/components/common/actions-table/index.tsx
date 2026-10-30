import { useAccessPermission } from '@/hooks/data/access-permission'
import { useConfirmModal } from '@/hooks/ui/confirm-modal'
import { DeleteFilled, EditFilled, EyeOutlined } from '@ant-design/icons'
import { Button, Tooltip } from 'antd'

export default function ActionsTable({
  entity = 'Entity',
  details = 'Details',
  actions = 'Actions',
  permissionSubject,
  onView,
  onEdit,
  onDelete,
  extraActions,
  hideDelete = false,
  hideEdit = false,
}: {
  entity: string
  details: string
  actions: string
  permissionSubject?: string
  onView?: () => void
  onEdit?: () => void
  onDelete?: () => void
  extraActions?: React.ReactNode
  hideDelete?: boolean
  hideEdit?: boolean
}) {
  const permission = useAccessPermission()
  const deleteModal = useConfirmModal({
    entity: entity,
    actions: actions,
    details: details,
    onOk: () => {
      onDelete?.()
    },
  })
  const editPermission = permissionSubject
    ? (permission.updateAny(permissionSubject).granted ||
        permission.updateOwn(permissionSubject).granted) &&
      !hideEdit
    : true
  const deletePermission = permissionSubject
    ? (permission.deleteAny(permissionSubject).granted ||
        permission.deleteOwn(permissionSubject).granted) &&
      !hideDelete
    : true

  return (
    <div className="flex flex-wrap gap-2 justify-center items-center">
      {extraActions}
      {onView && (
        <Tooltip title="View">
          <Button
            className="!size-8 !rounded-lg !border-[#DDE0E4] !bg-white !p-0 !text-[#8F96A3] hover:!text-[#0E203E] hover:!border-[#B0B6BF] flex items-center justify-center"
            aria-label="View"
            icon={<EyeOutlined style={{ fontSize: 13 }} />}
            onClick={() => {
              onView?.()
            }}
          />
        </Tooltip>
      )}
      {editPermission && onEdit && (
        <Tooltip title="Edit">
          <Button
            className="!size-8 !rounded-lg !border-[#DDE0E4] !bg-white !p-0 !text-[#8F96A3] hover:!text-[#0E203E] hover:!border-[#B0B6BF] flex items-center justify-center"
            aria-label="Edit"
            icon={<EditFilled style={{ fontSize: 13 }} />}
            onClick={() => {
              onEdit?.()
            }}
          />
        </Tooltip>
      )}
      {deletePermission && onDelete && (
        <Tooltip title="Delete">
          <Button
            danger
            type="primary"
            className="!size-8 !rounded-lg !border-[#E54C4C] !bg-[#E54C4C] !p-0 !text-white hover:!bg-[#d43f3f] hover:!border-[#d43f3f] flex items-center justify-center"
            aria-label="Delete"
            icon={<DeleteFilled style={{ fontSize: 13 }} />}
            onClick={() => {
              deleteModal()
            }}
          />
        </Tooltip>
      )}
    </div>
  )
}
