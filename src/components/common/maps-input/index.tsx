import { Button, Form, Input } from 'antd'
import { useEffect, useState } from 'react'

export default function MapsInput({
  name,
  label,
  initialValue,
}: {
  name: string
  label: string
  initialValue?: string | undefined | null
}) {
  const [value, setValue] = useState<string>('')

  useEffect(() => {
    if (initialValue) setValue(initialValue)
  }, [initialValue])

  return (
    <Form.Item name={name} label={label}>
      <div className="flex flex-wrap gap-4 items-center">
        <div className="grow">
          <Input.TextArea
            placeholder="Paste here!"
            onChange={(e) => {
              setValue(e.target.value)
            }}
            value={value}
            rows={6}
            onKeyDown={(e) => {
              const isPaste = (e.ctrlKey || e.metaKey) && e.key === 'v'
              if (!isPaste) {
                e.preventDefault()
              }
            }}
            disabled={!!value}
          />
        </div>
        {value && (
          <div>
            <Button
              onClick={() => {
                setValue('')
              }}
            >
              Clear
            </Button>
          </div>
        )}
      </div>

      {value?.includes('<iframe src="https://www.google.com/maps/embed?') && (
        <div className="mt-4" dangerouslySetInnerHTML={{ __html: value }} />
      )}
    </Form.Item>
  )
}
