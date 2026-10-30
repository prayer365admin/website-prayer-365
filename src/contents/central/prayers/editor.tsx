'use client'

import ContentsChurchesPrayersEditor from '@/contents/churches/prayers/editor'
import { useChurches } from '@/hooks/data/church'
import { useCentralPrayer } from '@/hooks/data/prayer'
import { Form, Result, Select } from 'antd'
import { useState } from 'react'
import styles from './editor.module.scss'

export default function ContentsCentralPrayerEditor({ prayerId }: { prayerId?: string }) {
  const isEdit = !!prayerId
  const [selectedChurchId, setSelectedChurchId] = useState<string>()
  const { data: prayer, loading: prayerLoading, error } = useCentralPrayer(prayerId ?? '')
  const { data: churches, loading: churchesLoading } = useChurches({
    queryString: '',
    limit: 100,
    page: 1,
    orderBy: 'name',
    orderDirection: 'asc',
  })

  const churchId = prayer?.churchId ?? selectedChurchId ?? ''
  const churchOptions = (churches ?? []).map((church) => ({
    value: church.id,
    label: church.name,
  }))
  if (prayer && !churchOptions.some((option) => option.value === prayer.churchId)) {
    churchOptions.unshift({ value: prayer.churchId, label: prayer.churchName })
  }

  const churchField = (
    <Form.Item label="Church" required>
      <Select
        aria-label="Church"
        className={`${styles.churchSelect} prayer-form-select`}
        disabled={isEdit}
        loading={churchesLoading || (isEdit && prayerLoading)}
        onChange={setSelectedChurchId}
        options={churchOptions}
        placeholder="Select church"
        showSearch={{ optionFilterProp: 'label' }}
        size="large"
        value={churchId || undefined}
      />
    </Form.Item>
  )

  if (isEdit && error) {
    return <Result status="404" title="Prayer not found" subTitle="This prayer is unavailable." />
  }

  return (
    <ContentsChurchesPrayersEditor
      key={churchId}
      churchContext={churchField}
      churchId={churchId}
      createdPrayerPath={(id) => `/dashboard/central/prayers/${id}`}
      formDisabled={!churchId}
      prayerId={prayerId}
    />
  )
}
