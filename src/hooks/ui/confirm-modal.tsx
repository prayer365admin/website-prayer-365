import { App } from 'antd'

export const useConfirmModal = ({
  entity,
  details,
  actions,
  onOk,
  onCancel,
}: {
  entity: string
  details: string
  actions: string
  onOk?: () => void
  onCancel?: () => void
}) => {
  const { modal } = App.useApp()
  const modalConfig = () => {
    modal.confirm({
      title: 'Are you sure?',
      content: (
        <p>
          Are you sure you want to proceed with <b>{actions.toUpperCase()}</b> for{' '}
          <b>{entity.toUpperCase()}</b> : <b>{details}</b>? <br />
          <br />
          This action cannot be undone. Do you want to continue?
        </p>
      ),
      okButtonProps: { className: '!bg-primary_color' },
      cancelButtonProps: {
        className: 'hover:!border-secondary_color hover:!text-secondary_color',
      },
      onOk: onOk,
      onCancel: onCancel,
    })
  }

  return modalConfig
}
