import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { MemoryRouter } from 'react-router-dom'
import i18n from '../src/i18n'
import SkillsPage from '../src/pages/SkillsPage'

const { getInstalledSkillsMock, searchSkillHubMock } = vi.hoisted(() => ({
  getInstalledSkillsMock: vi.fn(),
  searchSkillHubMock: vi.fn(),
}))

vi.mock('../src/lib/skills', async () => {
  const actual = await vi.importActual('../src/lib/skills')
  return {
    ...actual,
    getInstalledSkills: getInstalledSkillsMock,
  }
})

vi.mock('../src/lib/skillhub', async () => {
  const actual = await vi.importActual('../src/lib/skillhub')
  return {
    ...actual,
    searchSkillHub: searchSkillHubMock,
  }
})

function renderSkillsPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <SkillsPage />
      </MemoryRouter>
    </I18nextProvider>,
  )
}

describe('SkillsPage SkillHub boundary', () => {
  afterEach(() => cleanup())

  beforeEach(() => {
    localStorage.clear()
    getInstalledSkillsMock.mockResolvedValue([])
    searchSkillHubMock.mockReset()
  })

  it('renders a remote skill whose author is an object', async () => {
    searchSkillHubMock.mockResolvedValue([{
      slug: 'remote-research',
      name: 'Remote Research',
      description: 'A remote research skill',
      author: {
        name: 'Acme AI',
        logoUrl: 'https://example.com/logo.png',
        verified: true,
        certifiedName: 'Acme AI Labs',
        orgId: 'org-acme',
      },
    }])

    renderSkillsPage()

    await waitFor(() => expect(screen.getByText('Remote Research')).toBeInTheDocument())
    expect(screen.getByText('Acme AI')).toBeInTheDocument()
  })

  it('keeps built-in skills visible when the remote response is unavailable', async () => {
    searchSkillHubMock.mockRejectedValue(new Error('SkillHub unavailable'))

    renderSkillsPage()

    expect(screen.getByText('产品经理助手')).toBeInTheDocument()
  })

  it('keeps valid remote skills and built-ins when one remote card is malformed', async () => {
    searchSkillHubMock.mockResolvedValue([
      null,
      {
        slug: 'valid-remote',
        name: 'Valid Remote',
        description: 'A valid remote skill',
        author: 'Acme AI',
      },
    ])

    renderSkillsPage()

    expect(screen.getByText('产品经理助手')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Valid Remote')).toBeInTheDocument())
  })
})
