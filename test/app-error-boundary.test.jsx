import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import App from '../src/App'

const { throwingSkillsPage } = vi.hoisted(() => ({
  throwingSkillsPage: vi.fn(() => {
    throw new Error('malformed remote card')
  }),
}))

vi.mock('../src/pages/SkillsPage', () => ({ default: throwingSkillsPage }))

describe('App route error boundary', () => {
  afterEach(() => {
    cleanup()
    window.location.hash = ''
    vi.restoreAllMocks()
  })

  it('shows a recovery screen when the Skills route child fails to render', () => {
    window.location.hash = '#/skills'
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<App />)).not.toThrow()
    expect(screen.getByRole('alert')).toHaveTextContent('页面加载失败')
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument()
  })
})
