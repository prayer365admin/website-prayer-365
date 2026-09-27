import { Button, Col, Form, Input, Row, Select } from 'antd'
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons'
import { SocialMediaData } from '@/data/social-media'

export default function SocialMediaInput({ name, label }: { name: string; label: string }) {
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
                      <Form.Item {...restFields} name={[name, 'type']} style={{ marginBottom: 0 }}>
                        <Select
                          options={SocialMediaData}
                          placeholder="Instagram"
                          size="large"
                          className="flex items-center"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={11}>
                      <Form.Item
                        name={[name, 'url']}
                        rules={[{ type: 'url', message: 'Please input a valid url!' }]}
                        style={{ marginBottom: 0 }}
                      >
                        <Input placeholder="https://example.com" type="url" size="large" />
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
                  Add Social Media
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
