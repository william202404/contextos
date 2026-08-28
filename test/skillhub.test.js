import { describe, expect, it } from 'vitest'
import { normalizeSkillHubSkill } from '../src/lib/skillhub'

describe('normalizeSkillHubSkill', () => {
  it('turns the SkillHub author object into a display-safe name', () => {
    const normalized = normalizeSkillHubSkill({
      slug: 'research-assistant',
      name: 'Research Assistant',
      author: {
        name: 'Acme AI',
        logoUrl: 'https://example.com/logo.png',
        verified: true,
        certifiedName: 'Acme AI Labs',
        orgId: 'org-acme',
      },
    })

    expect(normalized.author).toBe('Acme AI')
  })

  it('keeps string authors and falls back for missing or malformed authors', () => {
    expect(normalizeSkillHubSkill({ slug: 'string-author', author: '  Lin  ' }).author).toBe('Lin')
    expect(normalizeSkillHubSkill({ slug: 'missing-author' }).author).toBe('社区作者')
    expect(normalizeSkillHubSkill({ slug: 'malformed-author', author: 42 }).author).toBe('社区作者')
  })
})
