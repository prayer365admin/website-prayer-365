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
}: {
  entity: string
  details: string
  actions: string
  permissionSubject?: string
  onEdit: () => void
  onDelete: () => void
}) {
  const permission = useAccessPermission()
  const deleteModal = useConfirmModal({
    entity: entity,
    actions: actions,
    details: details,
    onOk: () => {
      onDelete()
    },
  })
  const editPermission = permissionSubject ? permission.updateAny(permissionSubject).granted : true
  const deletePermission = permissionSubject
    ? permission.deleteAny(permissionSubject).granted
    : true

  return (
    <>
      <div className="flex flex-wrap gap-4">
        {editPermission && (
          <div className="cursor-pointer hover:opacity-50 transition-all duration-300">
            <Tooltip title="Edit">
              <EditFilled
                onClick={() => {
                  onEdit()
                }}
              />
            </Tooltip>
          </div>
        )}
        {deletePermission && (
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
