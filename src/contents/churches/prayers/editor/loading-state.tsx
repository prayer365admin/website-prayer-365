import { ArrowLeftOutlined } from '@ant-design/icons'
import styles from '../editor.module.scss'

export default function PrayerEditorLoadingState({ onBack }: { onBack: () => void }) {
  return (
    <section className={styles.page}>
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
          <div className={styles.titleSkeleton} />
        </div>
      </header>
      <div
        aria-busy="true"
        aria-label="Loading prayer editor"
        className={styles.editorSkeleton}
        role="status"
      >
        <div className={styles.tabsSkeleton}>
          <div className={`${styles.skeletonShape} ${styles.activeTabSkeleton}`} />
          <div className={`${styles.skeletonShape} ${styles.tabSkeleton}`} />
        </div>
        <div className={styles.formSkeleton}>
          <div className={`${styles.skeletonField} ${styles.inputFieldSkeleton}`} />
          <div className={`${styles.skeletonField} ${styles.imageFieldSkeleton}`} />
          <div className={`${styles.skeletonField} ${styles.editorFieldSkeleton}`} />
          <div className={styles.skeletonFieldGrid}>
            <div className={`${styles.skeletonField} ${styles.inputFieldSkeleton}`} />
            <div className={`${styles.skeletonField} ${styles.inputFieldSkeleton}`} />
          </div>
          <div className={`${styles.skeletonField} ${styles.bodyFieldSkeleton}`} />
          <div className={styles.skeletonActions}>
            <div className={`${styles.skeletonShape} ${styles.buttonSkeleton}`} />
            <div className={`${styles.skeletonShape} ${styles.buttonSkeleton}`} />
          </div>
        </div>
      </div>
    </section>
  )
}
