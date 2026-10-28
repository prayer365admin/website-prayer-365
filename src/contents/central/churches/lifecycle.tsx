'use client'

import type { ChurchLifecycleAction } from '@/hooks/data/central'
import type { ModalFuncProps } from 'antd'

/* D2 (suspension/archive effects) is still open in SPEC; these sentences are the
 * agreed visibility wording and must be re-checked when D2 is decided. */
export const LIFECYCLE: Record<
  ChurchLifecycleAction,
  { label: string; effect: string; danger?: boolean }
> = {
  approve: {
    label: 'Approve',
    effect: 'The church becomes visible in the public app and can publish content.',
  },
  suspend: {
    label: 'Suspend',
    effect: 'The church keeps its data but stops being publicly available.',
  },
  unsuspend: {
    label: 'Unsuspend',
    effect: 'The church becomes publicly available again and can publish content.',
  },
  archive: {
    label: 'Archive',
    effect:
      'Archiving removes this church from the public app. Its historical data, records, and reports remain preserved in the dashboard.',
    danger: true,
  },
}

export interface ModalConfirmInstance {
  confirm: (props: ModalFuncProps) => unknown
}

export const confirmLifecycle = (
  modal: ModalConfirmInstance,
  church: { name: string; version: number },
  action: ChurchLifecycleAction,
  run: (params: { action: ChurchLifecycleAction; version: number }) => Promise<unknown>,
): void => {
  const { label, effect, danger } = LIFECYCLE[action]
  modal.confirm({
    title: `${label} ${church.name}?`,
    content: <p>{effect}</p>,
    okText: label,
    okButtonProps: danger ? { danger: true } : undefined,
    onOk: () => run({ action, version: church.version }),
  })
}
