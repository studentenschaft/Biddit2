import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import AboutButton from '../../leftCol/sideNav/AboutButton'

// This is just a demo test :)

describe('AboutButton', () => {
  it('renders the button with correct text', () => {
    render(<AboutButton />)
    const buttonElement = screen.getByRole('button', { name: /about/i })
    expect(buttonElement).toBeInTheDocument()
  })
})