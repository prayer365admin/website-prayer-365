import s from './index.module.scss'

export default function BoxContainer({
  children,
  containerClassName,
  sectionClassName,
  isFullWidth = false,
  sectionId,
}: {
  children: React.ReactNode
  containerClassName?: string
  sectionClassName?: string
  isFullWidth?: boolean
  sectionId?: string
}) {
  return (
    <div className={`${s.section} ${sectionClassName}`} id={sectionId}>
      {!isFullWidth ? (
        <div className={`${s.container} ${containerClassName}`}>{children}</div>
      ) : (
        <div>{children}</div>
      )}
    </div>
  )
}
