export const AGENT_TEMPLATES = [
  {
    id: 'research-agent', name: 'AI 研究员', icon: '🔬',
    desc: '联网搜索 + 摘要 + 知识整理，自动完成深度研究任务',
    skillIds: ['literature-distiller'], mcpServerIds: ['brave-search'],
    tags: ['研究', '内容'], model: 'claude-sonnet-4-6',
    systemPrompt: '你是一位专业的 AI 研究助手，擅长通过搜索工具获取最新信息，并进行分析、总结和知识整理。',
    modelRequirements: { requiresToolSupport: true, supportedProviders: ['claude'] },
  },
  {
    id: 'code-assistant', name: '代码助手', icon: '💻',
    desc: '搜索 GitHub 仓库 + 读取代码文件，在真实代码库中提供帮助',
    skillIds: ['decision-framework'], mcpServerIds: ['github'],
    tags: ['开发', '工程'], model: 'claude-opus-4-8',
    systemPrompt: '你是一位经验丰富的软件工程师，擅长使用 GitHub 工具搜索和分析代码，提供专业的编程建议。',
    modelRequirements: { requiresToolSupport: true, supportedProviders: ['claude'] },
  },
]

export function buildTemplateProject({ template, projectId, now }) {
  const defaultSkillId = template.skillIds[0]
  return {
    id: projectId,
    name: template.name,
    knowledge: [],
    status: '',
    model: template.model,
    icon: template.icon,
    isTemp: false,
    activeSkillId: defaultSkillId,
    agentConfig: {
      templateId: template.id,
      systemPrompt: template.systemPrompt,
      defaultSkillId,
      requiredMcpServerIds: template.mcpServerIds,
      modelRequirements: template.modelRequirements,
    },
    createdAt: now,
    updatedAt: now,
  }
}

function promptValue(value) {
  return typeof value === 'string' && value.trim() ? value : ''
}

export function resolveSystemPrompt({ activeSkill, threadSystemPrompt, projectAgentConfig, genericDefault }) {
  const activeSkillPrompt = promptValue(activeSkill?.systemPrompt)
  if (activeSkillPrompt) return { prompt: activeSkillPrompt, source: 'active-skill' }

  const threadPrompt = promptValue(threadSystemPrompt)
  if (threadPrompt) return { prompt: threadPrompt, source: 'thread' }

  const projectPrompt = promptValue(projectAgentConfig?.systemPrompt)
  if (projectPrompt) return { prompt: projectPrompt, source: 'project-agent' }

  return { prompt: genericDefault, source: 'generic-default' }
}

export function resolveAgentReadiness({ agentConfig, connectedServerIds = [], modelInfo }) {
  const requiredMcpServerIds = agentConfig?.requiredMcpServerIds || []
  const connectedIds = new Set(connectedServerIds.map(server => typeof server === 'string' ? server : server.id))
  const missingMcpServerIds = requiredMcpServerIds.filter(id => !connectedIds.has(id))
  const requirements = agentConfig?.modelRequirements || {}
  const toolsReady = !requirements.requiresToolSupport
    || requirements.supportedProviders?.includes(modelInfo?.provider) === true

  return {
    chatReady: true,
    toolsReady,
    ready: toolsReady && missingMcpServerIds.length === 0,
    missingMcpServerIds,
  }
}
