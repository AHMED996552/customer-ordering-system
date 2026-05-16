import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import HomePage from '../pages/HomePage'

// wrap with router since cards will navigate
const renderWithRouter = (ui: React.ReactElement) =>
  render(<BrowserRouter>{ui}</BrowserRouter>)

describe('UC-1 Restaurant Catalog — Interaction', () => {
  test('open restaurant card is interactive', async () => {
    renderWithRouter(<HomePage />)

    const card = await screen.findByRole('button', {
      name: /burger palace/i,
    })

    expect(card).toBeEnabled()
  })

  test('closed restaurant card is non-interactive', async () => {
    renderWithRouter(<HomePage />)

    const card = await screen.findByRole('button', {
      name: /night bites/i,
    })

    expect(card).toBeDisabled()
    expect(screen.getByText(/currently closed/i)).toBeInTheDocument()
  })

  test('clicking closed restaurant does nothing', async () => {
    const user = userEvent.setup()

    renderWithRouter(<HomePage />)

    const card = await screen.findByRole('button', {
      name: /night bites/i,
    })

    await user.click(card)

    expect(window.location.pathname).toBe('/')
  })
})
