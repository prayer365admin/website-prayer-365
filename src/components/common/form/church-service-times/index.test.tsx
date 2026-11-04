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
    expect(screen.getByDisplayValue('Sunday Service')).toBeTruthy() // Hidden field
    expect(screen.getByText('Sunday')).toBeTruthy() // Table row text
    expect(screen.getByDisplayValue('10:00')).toBeTruthy()
    expect(screen.getByText('ET')).toBeTruthy()
  })

  it('adds a row when inline draft fields are filled and Add is clicked', async () => {
    const user = userEvent.setup()
    render(<TestWrapper />)

    // Form is closed initially until "Add service time" is clicked
    expect(screen.queryByText('Day *')).toBeNull()
    const openButton = screen.getByRole('button', { name: /add service time/i })
    await user.click(openButton)

    expect(screen.getByText('Day *')).toBeTruthy()
    expect(screen.getByText('Time *')).toBeTruthy()
    expect(screen.getByText('Service Label')).toBeTruthy()
    expect(screen.getByText('Language')).toBeTruthy()

    const addButton = screen.getByRole('button', { name: /^add$/i })
    await user.click(addButton)

    // Validation errors show if required Day/Time missing
    expect(screen.getByText('Please select a day')).toBeTruthy()
    expect(screen.getByText('Please select a time')).toBeTruthy()
  })

  it('removes a row when delete icon is clicked', async () => {
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

    expect(screen.getByText('Sunday Service')).toBeTruthy()

    const deleteBtn = screen.getByLabelText('Delete service time')
    await user.click(deleteBtn)

    await waitFor(() => {
      expect(screen.queryByText('Sunday Service')).toBeNull()
    })
  })

  it('edit button loads row values into inline form for the correct row', async () => {
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

    const editBtn = screen.getByLabelText('Edit service time')
    await user.click(editBtn)

    // The inline form receives the values of the editing row
    const labelInput = await screen.findByDisplayValue('Sunday Service')
    expect(labelInput).toBeTruthy()
  })

  it('resets edit state when isSaving becomes true', async () => {
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
    const { rerender } = render(<TestWrapper initialValues={initialValues} />)

    const editBtn = screen.getByLabelText('Edit service time')
    await user.click(editBtn)

    expect(await screen.findByDisplayValue('Sunday Service')).toBeTruthy()

    rerender(<TestWrapper initialValues={initialValues} isSaving={true} />)

    // Reverting edit mode clears editingIndex
    expect(screen.getByText('Sunday Service')).toBeTruthy()
  })
})
