import { describe, expect, it } from 'vitest'
import { Form, Button } from 'antd'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FormChurchServiceTimes from './index'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'

dayjs.extend(customParseFormat)

describe('FormChurchServiceTimes', () => {
  const TestWrapper = ({
    initialValues = {},
    isSaving = false,
  }: {
    initialValues?: Record<string, unknown>
    isSaving?: boolean
  }) => {
    return (
      <Form initialValues={initialValues}>
        <FormChurchServiceTimes isSaving={isSaving} />
        <Button htmlType="submit">Submit</Button>
      </Form>
    )
  }

  it('renders initial rows correctly', () => {
    const initialValues = {
      schedule: [
        {
          weekday: 7,
          localTime: dayjs('10:00', 'HH:mm'),
          label: 'Sunday Service',
          languageCode: 'et',
        },
      ],
    }

    render(<TestWrapper initialValues={initialValues} />)
    expect(screen.getByText('Sunday Service')).toBeTruthy() // Table cell
    expect(screen.getByDisplayValue('Sunday Service')).toBeTruthy() // Input
    expect(screen.getAllByText('Sunday')).toHaveLength(2) // Table row text + Select
    expect(screen.getByDisplayValue('10:00')).toBeTruthy()
    expect(screen.getByText('ET')).toBeTruthy()
  })

  it('adds an empty row when "Add service time" is clicked', async () => {
    const user = userEvent.setup()
    render(<TestWrapper />)

    const addButton = screen.getByRole('button', { name: /add service time/i })
    await user.click(addButton)

    expect(screen.getByText('Select day')).toBeTruthy()
  })

  it('removes a row when remove icon is clicked', async () => {
    const user = userEvent.setup()
    const initialValues = {
      schedule: [
        {
          weekday: 7,
          localTime: dayjs('10:00', 'HH:mm'),
          label: 'Sunday Service',
        },
      ],
    }

    render(<TestWrapper initialValues={initialValues} />)

    expect(screen.getByDisplayValue('Sunday Service')).toBeTruthy()

    const deleteBtn = screen.getByText('Delete')
    await user.click(deleteBtn)

    await waitFor(() => {
      expect(screen.queryByDisplayValue('Sunday Service')).toBeNull()
    })
  })

  it('edit button reveals the edit form for the correct row', async () => {
    const user = userEvent.setup()
    const initialValues = {
      schedule: [
        {
          weekday: 7,
          localTime: dayjs('10:00', 'HH:mm'),
          label: 'Sunday Service',
        },
      ],
    }

    render(<TestWrapper initialValues={initialValues} />)

    const editBtn = screen.getByText('Edit')
    await user.click(editBtn)

    // Just verify nothing crashes, the form becomes visible.
    // We can check if "Day / date" label is present.
    expect(screen.getAllByText('Day / date')).toHaveLength(2) // Table header + form item label
  })

  it('hides edit form when isSaving becomes true', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<TestWrapper />)

    const addButton = screen.getByRole('button', { name: /add service time/i })
    await user.click(addButton)

    const selectDay = screen.getByText('Select day')
    const editContainer = selectDay.closest('.mt-6') as HTMLElement
    expect(editContainer.style.display).toBe('block')

    rerender(<TestWrapper isSaving={true} />)
    expect(editContainer.style.display).toBe('none')
  })
})
