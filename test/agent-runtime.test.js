import { describe, expect, it } from 'vitest'
import {
  AGENT_TEMPLATES,
  buildTemplateProject,
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
    })

    expect(project.activeSkillId).toBe('literature-distiller')
    expect(project.agentConfig).toEqual({
      templateId: 'research-agent',
      systemPrompt: '你是一位专业的 AI 研究助手，擅长通过搜索工具获取最新信息，并进行分析、总结和知识整理。',
      defaultSkillId: 'literature-distiller',
      requiredMcpServerIds: ['brave-search'],
      modelRequirements: { requiresToolSupport: true, supportedProviders: ['claude'] },
    })
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
    })

    expect(readiness).toEqual({
      chatReady: true,
      toolsReady: true,
      ready: true,
      missingMcpServerIds: [],
    })
  })
})
