import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from '../src/App'

const { skillsPageMock } = vi.hoisted(() => ({
  skillsPageMock: vi.fn(),
}))

vi.mock('../src/pages/SkillsPage', () => ({ default: skillsPageMock }))

describe('App route error boundary', () => {
  afterEach(() => {
    cleanup()
    window.location.hash = ''
    vi.restoreAllMocks()
  })

  it('shows a recovery screen when the Skills route child fails to render', () => {
    window.location.hash = '#/skills'
    let shouldFail = true
    skillsPageMock.mockImplementation(() => {
      if (shouldFail) throw new Error('malformed remote card')
      return 'Skills recovered'
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<App />)).not.toThrow()
    expect(screen.getByRole('alert')).toHaveTextContent('页面加载失败')

    shouldFail = false
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    expect(screen.getByText('Skills recovered')).toBeInTheDocument()
  })
})
