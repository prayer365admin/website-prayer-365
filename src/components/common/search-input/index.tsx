import { CloseCircleFilled, SearchOutlined } from '@ant-design/icons'
import { Input } from 'antd'
import { ChangeEvent, Dispatch, SetStateAction, useState } from 'react'

export default function SearchInput({
  placeholder = 'Search by name or code',
  setValue,
  setPage,
  setPageSize,
}: {
  placeholder?: string
  setValue?: Dispatch<SetStateAction<string | undefined>>
  setPage: Dispatch<SetStateAction<number>>
  setPageSize: Dispatch<SetStateAction<number>>
}) {
  const [currentValue, setCurrentValue] = useState('')

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value || ''
    setCurrentValue(value)

    if (setValue && value === '') {
      setValue(value)
    }
  }

  const handleSubmit = () => {
    if (setValue) {
      setValue(currentValue)
    }

    setPage(1)
    setPageSize(10)

    return currentValue
  }

  const handleReset = () => {
    setCurrentValue('')
    if (setValue) {
      setValue('')
    }

    setPage(1)
    setPageSize(10)
  }

  return (
    <Input
      placeholder={placeholder}
      value={currentValue}
      onChange={handleChange}
      onPressEnter={handleSubmit}
      suffix={
        !currentValue ? (
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
