import { InfoCircleOutlined } from '@ant-design/icons'
import { VOICE_RECORDING_TIPS } from '@/utils/constant'
import { Button, Popover } from 'antd'

export default function RecordingTips() {
  return (
    <Popover
      title="Recording tips"
      trigger="click"
      content={
        <ul className="list-disc pl-5 max-w-md space-y-1">
          {VOICE_RECORDING_TIPS.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      }
    >
      <Button type="text" size="small" icon={<InfoCircleOutlined />} aria-label="Recording tips">
        Recording tips
      </Button>
    </Popover>
  )
}
