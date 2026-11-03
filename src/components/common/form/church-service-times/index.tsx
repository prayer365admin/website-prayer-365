'use client'

import { useState, useEffect } from 'react'
import { Form, Input, Select, TimePicker } from 'antd'
import { PlusOutlined, CloseOutlined, EditOutlined } from '@ant-design/icons'
import { TrashIcon } from '@/components/icon/trash'
import dayjs, { Dayjs } from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { LANGUAGE_OPTIONS } from '@/utils/constant'

dayjs.extend(customParseFormat)

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const WEEKDAY_OPTIONS = WEEKDAYS.map((day, i) => ({ value: i + 1, label: day }))

interface ServiceTimeDraft {
  weekday?: number
  localTime?: Dayjs | null
  label?: string
  languageCode?: string
}

export default function FormChurchServiceTimes({
  isSaving,
  onEditingChange,
}: {
  isSaving?: boolean
  onEditingChange?: (isEditing: boolean) => void
} = {}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [originalRowBeforeEdit, setOriginalRowBeforeEdit] = useState<ServiceTimeDraft | null>(null)
  const [draft, setDraft] = useState<ServiceTimeDraft>({})
  const [errors, setErrors] = useState<{ weekday?: string; localTime?: string }>({})

  const isFormOpen = isAdding || editingIndex !== null
  useEffect(() => {
    onEditingChange?.(isFormOpen)
  }, [isFormOpen, onEditingChange])

  const form = Form.useFormInstance()
  const scheduleValues = (Form.useWatch('schedule', form) || []) as ServiceTimeDraft[]

  useEffect(() => {
    if (isSaving) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setEditingIndex(null)
      setIsAdding(false)
      setOriginalRowBeforeEdit(null)
      setDraft({})
      setErrors({})
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [isSaving])

  const updateDraft = (updates: Partial<ServiceTimeDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...updates }
      if (editingIndex !== null && form) {
        form.setFieldValue(['schedule', editingIndex], next)
      }
      return next
    })
  }

  const handleStartEdit = (index: number) => {
    const row = form ? form.getFieldValue(['schedule', index]) : scheduleValues[index]
    setIsAdding(false)
    setEditingIndex(index)
    setOriginalRowBeforeEdit(row ? { ...row } : null)
    setErrors({})
  }

  const handleAddOrUpdate = (add: (val: unknown) => void) => {
    if (editingIndex !== null) {
      if (form) {
        const val = form.getFieldValue(['schedule', editingIndex]) || {}
        if (!val.weekday || !val.localTime) {
          return
        }
      }
      setEditingIndex(null)
      setIsAdding(false)
      setOriginalRowBeforeEdit(null)
      setDraft({})
      setErrors({})
    } else {
      const errs: { weekday?: string; localTime?: string } = {}
      if (!draft.weekday) {
        errs.weekday = 'Please select a day'
      }
      if (!draft.localTime) {
        errs.localTime = 'Please select a time'
      }
      if (errs.weekday || errs.localTime) {
        setErrors(errs)
        return
      }
      add({
        weekday: draft.weekday,
        localTime: draft.localTime,
        label: draft.label?.trim() || undefined,
        languageCode: draft.languageCode || undefined,
      })
      setIsAdding(false)
      setDraft({})
      setErrors({})
    }
  }

  const handleCancel = () => {
    if (editingIndex !== null && originalRowBeforeEdit && form) {
      form.setFieldValue(['schedule', editingIndex], originalRowBeforeEdit)
    }
    setEditingIndex(null)
    setIsAdding(false)
    setOriginalRowBeforeEdit(null)
    setDraft({})
    setErrors({})
  }

  const handleDelete = (remove: (name: number) => void, name: number, index: number) => {
    remove(name)
    if (editingIndex === index) {
      setEditingIndex(null)
      setIsAdding(false)
      setOriginalRowBeforeEdit(null)
      setDraft({})
      setErrors({})
    } else if (editingIndex !== null && editingIndex > index) {
      setEditingIndex(editingIndex - 1)
    }
  }

  return (
    <Form.List name="schedule">
      {(fields, { add, remove }) => {
        return (
          <div className="w-full flex flex-col bg-white overflow-x-auto flex-1 min-h-0">
            {/* Table Header */}
            <div className="bg-[#FAFAFB] flex flex-row items-center px-2 h-[34px] min-h-[34px] border-b border-[#DDE0E4] min-w-[480px] sm:min-w-0">
              <div className="w-[100px] sm:w-[180px] shrink-0 px-2 py-2 text-xs font-semibold text-[#5C6370]">
                Day
              </div>
              <div className="w-[80px] sm:w-[140px] shrink-0 px-2 py-2 text-xs font-semibold text-[#5C6370]">
                Time
              </div>
              <div className="flex-1 min-w-[140px] sm:min-w-0 px-2 py-2 text-xs font-semibold text-[#5C6370]">
                Service
              </div>
              <div className="w-[90px] sm:w-[120px] shrink-0 px-2 py-2 flex justify-end text-xs font-semibold text-[#5C6370]">
                Action
              </div>
            </div>

            {/* Empty state */}
            {fields.length === 0 && (
              <div className="p-6 text-center text-xs text-[#5C6370] bg-white border-b border-[#DDE0E4]">
                No service times added yet.
              </div>
            )}

            {/* Data rows */}
            {fields.map(({ key, name }, index) => {
              const rowValue = scheduleValues[name] || {}
              const dayName = rowValue.weekday ? WEEKDAYS[rowValue.weekday - 1] : '—'
              const timeStr = rowValue.localTime ? rowValue.localTime.format('HH:mm') : '—'

              return (
                <div
                  key={`row-${key}`}
                  className="flex flex-row items-center px-2 min-h-[64px] border-b border-[#DDE0E4] bg-white hover:bg-[#FAFAFB] transition-colors min-w-[480px] sm:min-w-0"
                >
                  {/* Hidden form bindings when row is not actively being edited in the inline row */}
                  {index !== editingIndex && (
                    <>
                      <Form.Item name={[name, 'weekday']} noStyle>
                        <Input type="hidden" />
                      </Form.Item>
                      <Form.Item
                        name={[name, 'localTime']}
                        noStyle
                        getValueProps={(val) => ({
                          value: val && dayjs.isDayjs(val) ? val.format('HH:mm') : val,
                        })}
                        normalize={(val) => (typeof val === 'string' ? dayjs(val, 'HH:mm') : val)}
                      >
                        <Input type="hidden" />
                      </Form.Item>
                      <Form.Item name={[name, 'label']} noStyle>
                        <Input type="hidden" />
                      </Form.Item>
                      <Form.Item name={[name, 'languageCode']} noStyle>
                        <Input type="hidden" />
                      </Form.Item>
                    </>
                  )}
                  <div className="w-[100px] sm:w-[180px] shrink-0 px-2 py-4 text-xs font-normal text-[#5C6370]">
                    {dayName}
                  </div>
                  <div className="w-[80px] sm:w-[140px] shrink-0 px-2 py-4 text-xs font-normal text-[#5C6370]">
                    {timeStr}
                  </div>
                  <div className="flex-1 min-w-[140px] sm:min-w-0 px-2 py-4 flex items-center gap-2 text-xs font-normal text-[#5C6370]">
                    <span>{rowValue.label || '—'}</span>
                    {rowValue.languageCode && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-[#E6EDFB] text-[#2F7AD2]">
                        {rowValue.languageCode.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="w-[90px] sm:w-[120px] shrink-0 px-2 py-4 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      aria-label="Edit service time"
                      onClick={() => handleStartEdit(index)}
                      className="w-8 h-8 rounded border border-[#DDE0E4] bg-white flex items-center justify-center text-[#B0B6BF] hover:border-[#2F7AD2] hover:text-[#2F7AD2] transition-colors cursor-pointer"
                    >
                      <span className="sr-only">Edit</span>
                      <EditOutlined style={{ fontSize: 13 }} />
                    </button>
                    <button
                      type="button"
                      aria-label="Delete service time"
                      onClick={() => handleDelete(remove, name, index)}
                      className="w-8 h-8 rounded border border-[#E54C4C] bg-[#E54C4C] flex items-center justify-center !text-white hover:bg-[#D93838] hover:border-[#D93838] transition-colors cursor-pointer"
                    >
                      <span className="sr-only">Delete</span>
                      <TrashIcon
                        style={{ fontSize: 12, color: '#FFFFFF' }}
                        className="!text-white"
                      />
                    </button>
                  </div>
                </div>
              )
            })}

            {isFormOpen ? (
              <div className="bg-[#FAFAFB] p-2 flex flex-wrap lg:flex-nowrap items-start gap-2 w-full">
                {/* Day Select */}
                <div className="w-full sm:w-[200px] shrink-0 flex flex-col gap-1">
                  <label className="text-sm font-semibold text-[#393E46] px-1">Day *</label>
                  {editingIndex !== null ? (
                    <Form.Item
                      name={[editingIndex, 'weekday']}
                      noStyle
                      rules={[{ required: true, message: 'Please select a day' }]}
                    >
                      <Select
                        placeholder="Select day"
                        options={WEEKDAY_OPTIONS}
                        className="w-full !h-10 [&_.ant-select-selector]:!h-10 [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!border-[#737C8C] [&_.ant-select-selection-item]:!leading-[38px] [&_.ant-select-selection-placeholder]:!leading-[38px] [&_.ant-select-selection-item]:!text-sm [&_.ant-select-selection-item]:!text-[#393E46]"
                      />
                    </Form.Item>
                  ) : (
                    <>
                      <Select
                        placeholder="Select day"
                        options={WEEKDAY_OPTIONS}
                        value={draft.weekday}
                        onChange={(val) => {
                          updateDraft({ weekday: val })
                          setErrors((e) => ({ ...e, weekday: undefined }))
                        }}
                        status={errors.weekday ? 'error' : undefined}
                        className="w-full !h-10 [&_.ant-select-selector]:!h-10 [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!border-[#737C8C] [&_.ant-select-selection-item]:!leading-[38px] [&_.ant-select-selection-placeholder]:!leading-[38px] [&_.ant-select-selection-item]:!text-sm [&_.ant-select-selection-item]:!text-[#393E46]"
                      />
                      {errors.weekday && (
                        <span className="text-xs text-[#E64C4C] px-1">{errors.weekday}</span>
                      )}
                    </>
                  )}
                </div>

                {/* Time TimePicker */}
                <div className="w-full sm:w-[200px] shrink-0 flex flex-col gap-1">
                  <label className="text-sm font-semibold text-[#393E46] px-1">Time *</label>
                  {editingIndex !== null ? (
                    <Form.Item
                      name={[editingIndex, 'localTime']}
                      noStyle
                      rules={[{ required: true, message: 'Please select a time' }]}
                    >
                      <TimePicker
                        format="HH:mm"
                        placeholder="Select time"
                        className="w-full !h-10 !rounded-lg !border-[#737C8C] !px-3 text-sm text-[#393E46]"
                      />
                    </Form.Item>
                  ) : (
                    <>
                      <TimePicker
                        format="HH:mm"
                        placeholder="Select time"
                        value={draft.localTime}
                        onChange={(val) => {
                          updateDraft({ localTime: val })
                          setErrors((e) => ({ ...e, localTime: undefined }))
                        }}
                        status={errors.localTime ? 'error' : undefined}
                        className="w-full !h-10 !rounded-lg !border-[#737C8C] !px-3 text-sm text-[#393E46]"
                      />
                      {errors.localTime && (
                        <span className="text-xs text-[#E64C4C] px-1">{errors.localTime}</span>
                      )}
                    </>
                  )}
                </div>

                {/* Service Label Input */}
                <div className="w-full sm:flex-1 min-w-[200px] flex flex-col gap-1">
                  <label className="text-sm font-semibold text-[#393E46] px-1">Service Label</label>
                  {editingIndex !== null ? (
                    <Form.Item name={[editingIndex, 'label']} noStyle>
                      <Input
                        placeholder="Service label"
                        maxLength={100}
                        className="!h-10 !rounded-lg !border-[#737C8C] !px-3 text-sm text-[#393E46]"
                      />
                    </Form.Item>
                  ) : (
                    <Input
                      placeholder="Service label"
                      maxLength={100}
                      value={draft.label ?? ''}
                      onChange={(e) => updateDraft({ label: e.target.value })}
                      className="!h-10 !rounded-lg !border-[#737C8C] !px-3 text-sm text-[#393E46]"
                    />
                  )}
                </div>

                {/* Language Select */}
                <div className="w-full sm:w-[200px] shrink-0 flex flex-col gap-1">
                  <label className="text-sm font-semibold text-[#393E46] px-1">Language</label>
                  {editingIndex !== null ? (
                    <Form.Item name={[editingIndex, 'languageCode']} noStyle>
                      <Select
                        placeholder="Select language"
                        allowClear
                        options={LANGUAGE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                        className="w-full !h-10 [&_.ant-select-selector]:!h-10 [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!border-[#737C8C] [&_.ant-select-selection-item]:!leading-[38px] [&_.ant-select-selection-placeholder]:!leading-[38px] [&_.ant-select-selection-item]:!text-sm [&_.ant-select-selection-item]:!text-[#393E46]"
                      />
                    </Form.Item>
                  ) : (
                    <Select
                      placeholder="Select language"
                      allowClear
                      options={LANGUAGE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                      value={draft.languageCode}
                      onChange={(val) => updateDraft({ languageCode: val })}
                      className="w-full !h-10 [&_.ant-select-selector]:!h-10 [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!border-[#737C8C] [&_.ant-select-selection-item]:!leading-[38px] [&_.ant-select-selection-placeholder]:!leading-[38px] [&_.ant-select-selection-item]:!text-sm [&_.ant-select-selection-item]:!text-[#393E46]"
                    />
                  )}
                </div>

                {/* Action Buttons */}
                <div className="shrink-0 flex items-center gap-2 pt-0 sm:pt-[25px]">
                  <button
                    aria-label={editingIndex !== null ? 'Update' : 'Add'}
                    onClick={() => handleAddOrUpdate(add)}
                    className="h-10 px-3 min-w-[75px] rounded-lg bg-white border border-[#2F7AD2] text-[#2F7AD2] text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#F5F7FF] transition-colors cursor-pointer shrink-0"
                  >
                    <span>Add</span>
                    <PlusOutlined className="text-sm text-[#2F7AD2]" />
                  </button>
                  <button
                    type="button"
                    aria-label="Cancel"
                    onClick={handleCancel}
                    className="h-10 w-10 p-0 rounded-lg bg-white border-0 flex items-center justify-center text-[#5C6370] hover:text-[#0E203E] hover:bg-gray-100 transition-colors cursor-pointer shrink-0"
                  >
                    <CloseOutlined style={{ fontSize: 16 }} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(true)
                    setEditingIndex(null)
                    setDraft({})
                    setErrors({})
                  }}
                  className="w-full h-12 rounded-lg border border-dashed border-[#DDE0E4] bg-white text-sm font-semibold text-[#5C6370] flex items-center justify-center gap-1.5 hover:border-[#2F7AD2] hover:text-[#2F7AD2] transition-colors cursor-pointer"
                >
                  <span>Add service time</span>
                  <PlusOutlined className="text-sm" />
                </button>
              </div>
            )}
          </div>
        )
      }}
    </Form.List>
  )
}
