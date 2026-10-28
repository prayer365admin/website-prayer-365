import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App, Button, Form } from 'antd'
import { describe, expect, it } from 'vitest'
import PasswordInput from './password-input'

function renderWithForm() {
  return render(
    <App>
      <Form>
        <PasswordInput required label="Password" />
        <Button htmlType="submit">Submit</Button>
      </Form>
    </App>,
  )
}

describe('PasswordInput', () => {
  it('renders both password fields', () => {
    renderWithForm()
    expect(screen.getByText('Password')).toBeTruthy()
    expect(screen.getByText('Confirm Password')).toBeTruthy()
  })

  it('rejects weak password with an accurate message', async () => {
    const user = userEvent.setup()
    renderWithForm()
    await user.type(screen.getAllByPlaceholderText('Password')[0], 'weak') // [0] = password, [1] = confirm (both share placeholder)
    await user.click(screen.getByText('Submit'))
    expect(
      await screen.findByText(
        'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number and a symbol (@$!%*?&).',
      ),
    ).toBeTruthy()
  })

  it('rejects mismatched confirmation', async () => {
    const user = userEvent.setup()
    renderWithForm()
    await user.type(screen.getAllByPlaceholderText('Password')[0], 'Strong@123') // [0] = password field
    await user.type(screen.getAllByPlaceholderText('Password')[1], 'Strong@1234') // [1] = confirm field
    await user.click(screen.getByText('Submit'))
    expect(await screen.findByText('Password and confirmation do not match!')).toBeTruthy()
  })
})
