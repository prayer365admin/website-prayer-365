import { Button, Col, Form, Row, Select, TimePicker } from 'antd'
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons'

export default function OpenHoursInput({ name, label }: { name: string; label: string }) {
  return (
    <div className="mb-4">
      <h3 className="mb-2">{label}</h3>
      <Form.List name={name} initialValue={[{}]}>
        {(fields, { add, remove }, { errors }) => {
          return (
            <div>
              {fields.map(({ key, name, ...restFields }) => {
                return (
                  <Row gutter={16} align={'middle'} className="mb-4" key={key}>
                    <Col span={11}>
                      <Form.Item {...restFields} name={[name, 'day']} style={{ marginBottom: 0 }}>
                        <Select
                          options={[
                            { value: 'MONDAY', label: 'Monday' },
                            { value: 'TUESDAY', label: 'Tuesday' },
                            { value: 'WEDNESDAY', label: 'Wednesday' },
                            { value: 'THURSDAY', label: 'Thursday' },
                            { value: 'FRIDAY', label: 'Friday' },
                            { value: 'SATURDAY', label: 'Saturday' },
                            { value: 'SUNDAY', label: 'Sunday' },
                          ]}
                          placeholder="Select Day"
                          size="large"
                          className="flex items-center"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={11}>
                      <Form.Item name={[name, 'hours']} style={{ marginBottom: 0 }}>
                        <TimePicker.RangePicker
                          format={'hh:mm A'}
                          size="large"
                          style={{ width: '100%' }}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={2}>
                      <MinusCircleOutlined onClick={() => remove(name)} />
                    </Col>
                  </Row>
                )
              })}
              <Col span={22}>
                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                  Add Open Hour
                </Button>
                <Form.ErrorList errors={errors} />
              </Col>
            </div>
          )
        }}
      </Form.List>
    </div>
  )
}
