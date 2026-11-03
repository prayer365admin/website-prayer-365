'use client'

import { siteFormTheme } from '@/config/antdTheme'
import { ConfigProvider, Drawer } from 'antd'
import { ChurchSetupForm } from './setup'

export default function ContentsCentralChurchDrawer({
  churchId,
  onClose,
}: {
  churchId?: string
  onClose: () => void
}) {
  return (
    <Drawer
      open
      onClose={onClose}
      size={800}
      placement="right"
      closeIcon={false}
      destroyOnHidden
      rootClassName="[&_.ant-drawer-content-wrapper]:!w-[calc(100vw-2rem)] sm:[&_.ant-drawer-content-wrapper]:!w-[800px] [&_.ant-drawer-content-wrapper]:!max-w-[calc(100vw-2rem)] sm:[&_.ant-drawer-content-wrapper]:!max-w-[800px] [&_.ant-drawer-content-wrapper]:!right-4 sm:[&_.ant-drawer-content-wrapper]:!right-6 [&_.ant-drawer-content-wrapper]:!top-4 sm:[&_.ant-drawer-content-wrapper]:!top-6 [&_.ant-drawer-content-wrapper]:!bottom-4 sm:[&_.ant-drawer-content-wrapper]:!bottom-6 [&_.ant-drawer-content-wrapper]:!h-[calc(100vh-2rem)] sm:[&_.ant-drawer-content-wrapper]:!h-[calc(100vh-3rem)] [&_.ant-drawer-content-wrapper]:!max-h-[880px] [&_.ant-drawer-content-wrapper]:!my-auto [&_.ant-drawer-content-wrapper]:!p-0 [&_.ant-drawer-content-wrapper]:!shadow-none [&_.ant-drawer-content]:!rounded-2xl [&_.ant-drawer-content]:!overflow-hidden [&_.ant-drawer-content]:!shadow-2xl [&_.ant-drawer-content]:!h-full [&_.ant-drawer-content]:!bg-white [&_.ant-drawer-body]:!p-0 [&_.ant-drawer-body]:!flex [&_.ant-drawer-body]:!flex-col [&_.ant-drawer-body]:!h-full [&_.ant-drawer-body]:!overflow-hidden [&_.ant-drawer-mask]:!bg-[#0e203e]/35"
      styles={{
        wrapper: {
          boxSizing: 'border-box',
        },
        section: {
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(14, 32, 62, 0.15)',
          maxHeight: 880,
          margin: 'auto 0',
        },
        body: {
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
        },
      }}
    >
      <ConfigProvider theme={siteFormTheme}>
        <ChurchSetupForm churchId={churchId} onClose={onClose} isDrawer />
      </ConfigProvider>
    </Drawer>
  )
}
