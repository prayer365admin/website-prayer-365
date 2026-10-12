/** Numbered section title of a sign-up step ("1 Personal & Baptismal Identity"). */
export default function StepHeader({ step, title }: { step: number; title: string }) {
  return (
    <h2 className="flex items-center gap-3 font-font_heading text-2xl font-semibold text-accent_color_1">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary_color/30 text-xs font-medium text-accent_color_2">
        {step}
      </span>
      {title}
    </h2>
  )
}
