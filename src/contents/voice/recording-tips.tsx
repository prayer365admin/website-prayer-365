import { InfoCircleOutlined } from '@ant-design/icons'
import { Button, Popover } from 'antd'

/** ElevenLabs Instant Voice Cloning recording guidance, shortened (F4VO). */
export const RECORDING_TIPS = [
  'Record 1–2 minutes in total. More than 3 minutes adds little and can make the clone worse.',
  'Total length across all files counts, not the number of files.',
  'Recording quality beats length: no reverb, background noise, clicks or artifacts.',
  'MP3 at 128 kbps or higher is enough; a higher bitrate does not help much.',
  'Keep tone, pace and quality consistent across all samples. The AI copies everything, including breathing and noise.',
  'Speak the way the prayers should sound: slow and flat in means slow and flat out.',
  'Aim for volume around −23 to −18 dB RMS, with peaks no higher than −3 dB.',
]

export default function RecordingTips() {
  return (
    <Popover
      title="Recording tips"
      trigger="click"
      content={
        <ul className="list-disc pl-5 max-w-md space-y-1">
          {RECORDING_TIPS.map((tip) => (
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
