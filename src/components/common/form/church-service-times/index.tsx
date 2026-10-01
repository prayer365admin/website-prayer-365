'use client'
import { Button, Col, Form, Input, Row, Select, TimePicker } from 'antd'
import { useState, useEffect } from 'react'

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const LANGUAGE_CODES = ['en', 'et', 'fi']
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'

dayjs.extend(customParseFormat)

export default function FormChurchServiceTimes({ isSaving }: { isSaving?: boolean } = {}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  useEffect(() => {
    if (isSaving) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditingIndex(null)
    }
  }, [isSaving])

  const form = Form.useFormInstance()
  const scheduleValues = Form.useWatch('schedule', form) || []

  return (
    <Form.List name="schedule">
      {(fields, { add, remove }) => {
        return (
          <div>
            <div className="border border-gray-200 rounded-t-md bg-gray-100 flex p-3 font-semibold text-gray-700">
              <div className="w-1/4">Day / date</div>
              <div className="w-1/4">Time</div>
              <div className="w-1/4">Service label</div>
              <div className="w-1/4">Action</div>
            </div>

            {fields.length === 0 && (
              <div className="border-x border-b border-gray-200 p-4 text-center text-gray-500">
                No service times added yet.
              </div>
            )}

            {fields.map(({ key, name }, index) => {
              const rowValue = scheduleValues[name] || {}
              const dayName = rowValue.weekday ? WEEKDAYS[rowValue.weekday - 1] : ''
              const timeStr = rowValue.localTime ? rowValue.localTime.format('HH:mm') : ''

              return (
                <div
                  key={`row-${key}`}
                  className="border-x border-b border-gray-200 flex p-3 bg-white items-center"
                >
                  <div className="w-1/4">{dayName}</div>
                  <div className="w-1/4">{timeStr}</div>
                  <div className="w-1/4">{rowValue.label}</div>
                  <div className="w-1/4">
                    <a
                      onClick={() => setEditingIndex(index)}
                      className="mr-4 text-blue-600 hover:text-blue-800"
                    >
                      Edit
                    </a>
                    <a
                      className="text-red-500 hover:text-red-700"
                      onClick={() => {
                        remove(name)
                        if (editingIndex === index) {
                          setEditingIndex(null)
                        } else if (editingIndex !== null && editingIndex > index) {
                          setEditingIndex(editingIndex - 1)
                        }
                      }}
                    >
                      Delete
                    </a>
                  </div>
                </div>
              )
            })}

            <div className="mt-4">
              <Button
                onClick={() => {
                  add({ weekday: undefined, localTime: undefined })
                  setEditingIndex(fields.length)
                }}
              >
                Add service time
              </Button>
            </div>

            {fields.map(({ key, name, ...restField }, index) => {
              return (
                <div
                  key={`edit-${key}`}
                  style={{ display: index === editingIndex ? 'block' : 'none' }}
                  className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-md"
                >
                  <Row gutter={16}>
                    <Col span={6}>
                      <Form.Item
                        {...restField}
                        name={[name, 'weekday']}
                        label="Day / date"
                        rules={[{ required: true, message: 'Please select a day' }]}
                        style={{ marginBottom: 0 }}
                      >
                        <Select
                          options={WEEKDAYS.map((day, i) => ({ value: i + 1, label: day }))}
                          placeholder="Select day"
                          size="large"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item
                        {...restField}
                        name={[name, 'localTime']}
                        label="Time"
                        rules={[{ required: true, message: 'Please select a time' }]}
                        style={{ marginBottom: 0 }}
                      >
                        <TimePicker format="HH:mm" size="large" style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item
                        {...restField}
                        name={[name, 'label']}
                        label="Service label"
                        style={{ marginBottom: 0 }}
                      >
                        <Input
                          placeholder="Service label (optional)"
                          maxLength={100}
                          size="large"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item
                        {...restField}
                        name={[name, 'languageCode']}
                        label="Language"
                        style={{ marginBottom: 0 }}
                      >
                        <Select
                          allowClear
                          placeholder="Language (optional)"
                          options={LANGUAGE_CODES.map((code) => ({
                            value: code,
                            label: code.toUpperCase(),
                          }))}
                          size="large"
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </div>
              )
            })}
          </div>
        )
      }}
    </Form.List>
  )
}
