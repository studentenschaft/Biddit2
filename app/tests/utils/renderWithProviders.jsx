import React from 'react'
import { RecoilRoot } from 'recoil'
import { render } from '@testing-library/react'

// Utility to render components/hooks with Recoil and optional initial state
export function renderWithProviders(ui, { initializeState } = {}) {
  const Wrapper = ({ children }) => (
    <RecoilRoot initializeState={initializeState}>{children}</RecoilRoot>
  )
  return render(ui, { wrapper: Wrapper })
}

export function createWrapper({ initializeState } = {}) {
  return ({ children }) => (
    <RecoilRoot initializeState={initializeState}>{children}</RecoilRoot>
  )
}

