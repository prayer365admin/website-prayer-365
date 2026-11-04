import { ExclamationCircleFilled } from '@ant-design/icons'
import { App } from 'antd'
import React from 'react'

export interface ConfirmModalProps {
  entity?: string
  details?: string
  actions?: string
  title?: React.ReactNode
  description?: React.ReactNode
  content?: React.ReactNode
  okText?: string
  cancelText?: string
  danger?: boolean
  onOk?: () => void | Promise<unknown>
  onCancel?: () => void
}

export const useConfirmModal = (defaultProps?: ConfirmModalProps) => {
  const { modal } = App.useApp()

  const modalConfig = () => {
    const {
      entity = 'ITEM',
      details = '',
      actions = 'DELETING',
      title = 'Are you sure?',
      description,
      content,
      okText = 'OK',
      cancelText = 'Cancel',
      danger,
      onOk,
      onCancel,
    } = defaultProps || {}

    const isDestructive =
      danger !== undefined
        ? danger
        : typeof actions === 'string' && /delete|deleting|purge|destroy|archive/i.test(actions)

    const modalContent = content ?? (
      <div className="text-sm text-[#393E46] leading-relaxed mt-2">
        <p className="mb-3">
          Are you sure you want to proceed with <b>{actions.toUpperCase()}</b> for{' '}
          <b>{entity.toUpperCase()}</b>{' '}
          {details ? (
            <>
              : <b>{details}</b>
            </>
          ) : null}
          ?
        </p>
        <p className="m-0 text-[#5C6370]">
          {description || 'This action cannot be undone. Do you want to continue?'}
        </p>
      </div>
    )

    modal.confirm({
      icon: <ExclamationCircleFilled className="!text-[#FAAD14] !text-2xl" />,
      title: <span className="text-lg font-semibold text-[#0E203E]">{title}</span>,
      content: modalContent,
      centered: true,
      width: 460,
      rootClassName:
        '[&_.ant-modal-content]:!rounded-2xl [&_.ant-modal-content]:!p-6 [&_.ant-modal-content]:!shadow-2xl [&_.ant-modal-confirm-title]:!text-lg [&_.ant-modal-confirm-title]:!font-semibold [&_.ant-modal-confirm-title]:!text-[#0E203E] [&_.ant-modal-confirm-btns]:!mt-6 [&_.ant-modal-confirm-btns]:!flex [&_.ant-modal-confirm-btns]:!justify-end [&_.ant-modal-confirm-btns]:!gap-2',
      okText,
      cancelText,
      okButtonProps: {
        danger: isDestructive,
        className: isDestructive
          ? '!h-9 !px-4 !rounded-lg !bg-[#E54C4C] hover:!bg-[#D43F3F] !border-[#E54C4C] hover:!border-[#D43F3F] !text-white !font-medium !shadow-sm'
          : '!h-9 !px-4 !rounded-lg !bg-[#2F7AD2] hover:!bg-[#1758A6] !border-[#2F7AD2] hover:!border-[#1758A6] !text-white !font-medium !shadow-sm',
      },
      cancelButtonProps: {
        className:
          '!h-9 !px-4 !rounded-lg !bg-white hover:!bg-neutral-50 !border-[#DDE0E4] hover:!border-[#B0B6BF] !text-[#393E46] !font-medium',
      },
      onOk,
      onCancel,
    })
  }

  return modalConfig
}
