import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { RotateHint } from '../RotateHint'

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true })
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true, writable: true })
}

describe('RotateHint', () => {
  afterEach(() => setViewport(1024, 768))

  it('shows in portrait when enabled', () => {
    setViewport(390, 844)
    render(<RotateHint enabled />)
    expect(screen.getByRole('dialog', { name: /rotate/i })).toBeInTheDocument()
  })

  it('hides in landscape', () => {
    setViewport(844, 390)
    render(<RotateHint enabled />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('hides when disabled even in portrait', () => {
    setViewport(390, 844)
    render(<RotateHint enabled={false} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('reacts to orientation changes', () => {
    setViewport(390, 844)
    render(<RotateHint enabled />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    act(() => {
      setViewport(844, 390)
      window.dispatchEvent(new Event('orientationchange'))
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
