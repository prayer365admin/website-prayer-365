import { ArrowLeftOutlined } from '@ant-design/icons'
import styles from '../editor.module.scss'

export default function PrayerEditorHeader({
  onBack,
  title,
}: {
  onBack: () => void
  title: string
}) {
  return (
    <header className={styles.editorHeader}>
      <button
        aria-label="Back to prayers"
        className={styles.backButton}
        onClick={onBack}
        type="button"
      >
        <ArrowLeftOutlined />
      </button>
      <div>
        <div className={styles.titleLabel}>
          Prayer title <span>*</span>
        </div>
        <h1>{title}</h1>
      </div>
    </header>
  )
}
