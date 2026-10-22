import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App.jsx'

describe('App', () => {
  it('shows the sign-in screen when there is no session', async () => {
    render(<App />)
    expect(await screen.findByText(/Sign in to continue/i)).toBeTruthy()
  })
})
