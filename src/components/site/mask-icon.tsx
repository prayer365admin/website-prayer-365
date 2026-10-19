/** Recolours a single-colour SVG from /public: the file is the mask, the class sets the colour. */
export default function MaskIcon({
  src,
  className,
  size,
}: {
  src: string
  className: string
  size: number
}) {
  return (
    <span
      aria-hidden="true"
      className={`block shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        mask: `url(${src}) center / contain no-repeat`,
        WebkitMask: `url(${src}) center / contain no-repeat`,
      }}
    />
  )
}
