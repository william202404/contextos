import { describe, expect, it } from 'vitest'
import {
  AGENT_TEMPLATES,
  buildTemplateProject,
  deployAgentTemplate,
  normalizeProjectRuntime,
  resolveAgentReadiness,
  resolveSystemPrompt,
} from '../src/lib/agentRuntime'

describe('agent template runtime contract', () => {
  it('creates a research project with its canonical agent config and default skill bound', () => {
    const researchTemplate = AGENT_TEMPLATES.find(template => template.id === 'research-agent')

    const project = buildTemplateProject({
      template: researchTemplate,
      projectId: 'project-research',
      now: 1724803200000,
      installedDefaultSkillId: 'installed-literature-distiller',
    })

    expect(project.activeSkillId).toBe('installed-literature-distiller')
    expect(project.agentConfig).toEqual({
      templateId: 'research-agent',
      systemPrompt: '你是一位专业的 AI 研究助手，擅长通过搜索工具获取最新信息，并进行分析、总结和知识整理。',
      defaultSkillId: 'installed-literature-distiller',
      requiredMcpServerIds: ['brave-search'],
      modelRequirements: { requiresToolSupport: true, supportedProviders: ['claude'] },
    })
  })

  it('persists the installed default skill identity when deploying a template', async () => {
    const savedProjects = []
    const installedSkillIds = []
    const connectedServerIds = []

    const project = await deployAgentTemplate({
      template: AGENT_TEMPLATES.find(template => template.id === 'research-agent'),
      projectId: 'project-research',
      now: 1724803200000,
      installSkill: async skillId => {
        installedSkillIds.push(skillId)
        return { id: `persisted-${skillId}` }
      },
      connectServer: async serverId => { connectedServerIds.push(serverId) },
      saveProject: async record => { savedProjects.push(record) },
    })

    expect(installedSkillIds).toEqual(['literature-distiller'])
    expect(connectedServerIds).toEqual(['brave-search'])
    expect(project.activeSkillId).toBe('persisted-literature-distiller')
    expect(project.agentConfig.defaultSkillId).toBe('persisted-literature-distiller')
    expect(savedProjects).toEqual([project])
  })

  it('restores canonical and recognized legacy template project skill bindings', () => {
    const legacyTemplate = AGENT_TEMPLATES.find(template => template.id === 'research-agent')
    const canonical = normalizeProjectRuntime({
      id: 'canonical-project',
      agentConfig: { templateId: 'research-agent', systemPrompt: 'canonical prompt', defaultSkillId: 'persisted-literature-distiller' },
    })
    const legacy = normalizeProjectRuntime({
      id: 'legacy-template-project', model: legacyTemplate.model, systemPrompt: legacyTemplate.systemPrompt,
    })
    const ordinary = normalizeProjectRuntime({ id: 'ordinary-project', systemPrompt: '用户自行保存的普通项目提示词' })

    expect(canonical.activeSkillId).toBe('persisted-literature-distiller')
    expect(legacy).toMatchObject({
      activeSkillId: 'literature-distiller',
      agentConfig: { templateId: 'research-agent', systemPrompt: legacyTemplate.systemPrompt, defaultSkillId: 'literature-distiller' },
    })
    expect(ordinary.agentConfig).toBeUndefined()
    expect(ordinary.activeSkillId).toBeUndefined()
  })

  it.each([
    ['an explicitly active skill', { systemPrompt: 'active skill prompt' }, 'thread prompt', { systemPrompt: 'project prompt' }, 'active skill prompt', 'active-skill'],
    ['a thread override after no active skill', null, 'thread prompt', { systemPrompt: 'project prompt' }, 'thread prompt', 'thread'],
    ['the project agent prompt after no skill or thread override', null, '', { systemPrompt: 'project prompt' }, 'project prompt', 'project-agent'],
    ['the generic default when no configured prompt exists', null, '', null, 'generic prompt', 'generic-default'],
  ])('uses %s for the effective prompt', (_caseName, activeSkill, threadSystemPrompt, projectAgentConfig, expectedPrompt, expectedSource) => {
    expect(resolveSystemPrompt({
      activeSkill,
      threadSystemPrompt,
      projectAgentConfig,
      genericDefault: 'generic prompt',
    })).toEqual({ prompt: expectedPrompt, source: expectedSource })
  })

  it('reports missing required MCP servers instead of a ready agent', () => {
    const readiness = resolveAgentReadiness({
      agentConfig: {
        requiredMcpServerIds: ['brave-search', 'github'],
        modelRequirements: { requiresToolSupport: true, supportedProviders: ['claude'] },
      },
      connectedServerIds: ['brave-search'],
      modelInfo: { provider: 'claude' },
      modelReady: true,
      enabledTools: [{ _serverId: 'brave-search', name: 'web_search' }],
    })

    expect(readiness).toMatchObject({
      chatReady: true,
      toolsReady: true,
      ready: false,
      missingMcpServerIds: ['github'],
    })
  })

  it('keeps chat capability honest when the selected provider cannot execute tools', () => {
    const readiness = resolveAgentReadiness({
      agentConfig: {
        requiredMcpServerIds: ['brave-search'],
        modelRequirements: { requiresToolSupport: true, supportedProviders: ['claude'] },
      },
      connectedServerIds: ['brave-search'],
      modelInfo: { provider: 'openai' },
      modelReady: true,
      enabledTools: [{ _serverId: 'brave-search', name: 'web_search' }],
    })

    expect(readiness).toMatchObject({
      chatReady: true,
      toolsReady: false,
      ready: false,
      missingMcpServerIds: [],
    })
  })

  it('reports a Claude configuration with all required MCP servers as ready', () => {
    const readiness = resolveAgentReadiness({
      agentConfig: {
        requiredMcpServerIds: ['brave-search'],
        modelRequirements: { requiresToolSupport: true, supportedProviders: ['claude'] },
      },
      connectedServerIds: ['brave-search'],
      modelInfo: { provider: 'claude' },
      modelReady: true,
      enabledTools: [{ _serverId: 'brave-search', name: 'web_search' }],
    })

    expect(readiness).toMatchObject({
      chatReady: true,
      toolsReady: true,
      ready: true,
      missingMcpServerIds: [],
    })
  })

  it('does not report an agent ready when credentials or required enabled tools are absent', () => {
    const agentConfig = {
      requiredMcpServerIds: ['brave-search'],
      modelRequirements: { requiresToolSupport: true, supportedProviders: ['claude'] },
    }
    const missingCredentials = resolveAgentReadiness({
      agentConfig,
      connectedServerIds: ['brave-search'],
      enabledTools: [{ _serverId: 'brave-search', name: 'web_search' }],
      modelInfo: { provider: 'claude' },
      modelReady: false,
    })
    const disabledRequiredTools = resolveAgentReadiness({
      agentConfig,
      connectedServerIds: ['brave-search'],
      enabledTools: [],
      modelInfo: { provider: 'claude' },
      modelReady: true,
    })

    expect(missingCredentials).toMatchObject({ chatReady: false, toolsReady: false, ready: false })
    expect(disabledRequiredTools).toMatchObject({
      chatReady: true,
      toolsReady: false,
      ready: false,
      unavailableMcpServerIds: ['brave-search'],
    })
  })
})
