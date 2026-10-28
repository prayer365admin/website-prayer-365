import { CloseCircleFilled, LoadingOutlined, SearchOutlined } from '@ant-design/icons'
import { Input } from 'antd'
import { ChangeEvent, Dispatch, SetStateAction, useEffect, useRef, useState } from 'react'

export default function SearchInput({
  placeholder = 'Search by name or code',
  setValue,
  setPage,
  setPageSize,
  loading = false,
  debounceMs = 500,
  iconPosition = 'suffix',
  className,
}: {
  className?: string
  placeholder?: string
  setValue?: Dispatch<SetStateAction<string | undefined>>
  setPage: Dispatch<SetStateAction<number>>
  setPageSize: Dispatch<SetStateAction<number>>
  loading?: boolean
  debounceMs?: number
  iconPosition?: 'prefix' | 'suffix'
}) {
  const [currentValue, setCurrentValue] = useState('')
  const debouncedRef = useRef(currentValue)

  useEffect(() => {
    if (!setValue) return
    const timer = setTimeout(() => {
      if (debouncedRef.current !== currentValue) {
        debouncedRef.current = currentValue
        setValue(currentValue)
        setPage(1)
        setPageSize(10)
      }
    }, debounceMs)
    return () => clearTimeout(timer)
  }, [currentValue, debounceMs, setPage, setPageSize, setValue])
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value || ''
    setCurrentValue(value)
  }

  const handleSubmit = () => {
    debouncedRef.current = currentValue
    if (setValue) {
      setValue(currentValue)
    }

    setPage(1)
    setPageSize(10)

    return currentValue
  }

  const handleReset = () => {
    debouncedRef.current = ''
    setCurrentValue('')
    if (setValue) {
      setValue('')
    }

    setPage(1)
    setPageSize(10)
  }

  const searchIcon = loading ? (
    <LoadingOutlined spin style={{ color: 'rgb(107 114 128)' }} />
  ) : (
    <SearchOutlined
      style={{ color: 'rgb(107 114 128)', cursor: 'pointer' }}
      onMouseDown={handleSubmit}
    />
  )

  return (
    <Input
      placeholder={placeholder}
      value={currentValue}
      onChange={handleChange}
      onPressEnter={handleSubmit}
      prefix={iconPosition === 'prefix' ? searchIcon : undefined}
      suffix={
        currentValue ? (
          <CloseCircleFilled style={{ cursor: 'pointer' }} onMouseDown={handleReset} />
        ) : iconPosition === 'suffix' ? (
          searchIcon
        ) : undefined
      }
      className={`truncate !h-10 !rounded-lg !border-[#DDE0E4] ${className ?? ''}`.trim()}
    />
  )
}
