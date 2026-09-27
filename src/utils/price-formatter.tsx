export default function priceFormatter({ value }: { value: number | string }) {
  const numericValue = typeof value === 'string' ? parseFloat(value) : value
  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return formatter.format(numericValue)
}
