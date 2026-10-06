import { useAccessPermission } from '@/hooks/data/access-permission'
import { useConfirmModal } from '@/hooks/ui/confirm-modal'
import { DeleteFilled, EditFilled } from '@ant-design/icons'
import { Tooltip } from 'antd'

export default function ActionsTable({
  entity = 'Entity',
  details = 'Details',
  actions = 'Actions',
  permissionSubject,
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
    <>
      <div className="flex flex-wrap gap-4 justify-center">
        {extraActions}
        {editPermission && onEdit && (
          <div className="cursor-pointer hover:opacity-50 transition-all duration-300">
            <Tooltip title="Edit">
              <EditFilled
                onClick={() => {
                  onEdit?.()
                }}
              />
            </Tooltip>
          </div>
        )}
        {deletePermission && onDelete && (
          <div className="cursor-pointer hover:opacity-50 transition-all duration-300">
            <Tooltip title="Delete">
              <DeleteFilled
                onClick={() => {
                  deleteModal()
                }}
              />
            </Tooltip>
          </div>
        )}
      </div>
    </>
  )
}
