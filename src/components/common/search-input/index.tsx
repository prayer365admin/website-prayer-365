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
}: {
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

  const isPrefix = iconPosition === 'prefix'

  return (
    <Input
      placeholder={placeholder}
      value={currentValue}
      onChange={handleChange}
      onPressEnter={handleSubmit}
      prefix={
        isPrefix ? (
          loading ? (
            <LoadingOutlined spin style={{ color: 'rgb(107 114 128)' }} />
          ) : (
            <SearchOutlined
              style={{ color: '#0E203E', cursor: 'pointer', fontSize: 14 }}
              onMouseDown={handleSubmit}
            />
          )
        ) : undefined
      }
      suffix={
        isPrefix ? (
          currentValue ? (
            <CloseCircleFilled style={{ cursor: 'pointer' }} onMouseDown={handleReset} />
          ) : null
        ) : loading ? (
          <LoadingOutlined spin style={{ color: 'rgb(107 114 128)' }} />
        ) : !currentValue ? (
          <SearchOutlined
            style={{ color: 'rgb(107 114 128)', cursor: 'pointer' }}
            onMouseDown={handleSubmit}
          />
        ) : (
          <CloseCircleFilled style={{ cursor: 'pointer' }} onMouseDown={handleReset} />
        )
      }
      className="truncate"
    />
  )
}
