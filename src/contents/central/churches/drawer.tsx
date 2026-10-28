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
      rootClassName="[&_.ant-drawer-content]:!rounded-l-2xl [&_.ant-drawer-content]:!shadow-2xl [&_.ant-drawer-body]:!p-0 [&_.ant-drawer-body]:flex [&_.ant-drawer-body]:flex-col [&_.ant-drawer-body]:h-full [&_.ant-drawer-body]:overflow-hidden"
      styles={{ body: { padding: 0 } }}
    >
      <ConfigProvider theme={siteFormTheme}>
        <ChurchSetupForm churchId={churchId} onClose={onClose} isDrawer />
      </ConfigProvider>
    </Drawer>
  )
}
