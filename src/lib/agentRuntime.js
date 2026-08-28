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

function buildAgentConfig(template, defaultSkillId) {
  return {
    templateId: template.id,
    systemPrompt: template.systemPrompt,
    defaultSkillId,
    requiredMcpServerIds: template.mcpServerIds,
    modelRequirements: template.modelRequirements,
  }
}

export function buildTemplateProject({ template, projectId, now, installedDefaultSkillId }) {
  const defaultSkillId = installedDefaultSkillId
  return {
    id: projectId,
    name: template.name,
    knowledge: [],
    status: '',
    model: template.model,
    icon: template.icon,
    isTemp: false,
    activeSkillId: defaultSkillId,
    agentConfig: buildAgentConfig(template, defaultSkillId),
    createdAt: now,
    updatedAt: now,
  }
}

export async function deployAgentTemplate({ template, projectId, now, installSkill, connectServer, saveProject }) {
  let installedDefaultSkillId
  for (const skillId of template.skillIds) {
    const installedSkill = await installSkill(skillId)
    if (skillId === template.skillIds[0]) installedDefaultSkillId = installedSkill.id
  }
  for (const serverId of template.mcpServerIds) await connectServer(serverId)

  const project = buildTemplateProject({ template, projectId, now, installedDefaultSkillId })
  await saveProject(project)
  return project
}

export function normalizeProjectRuntime(project) {
  if (!project) return project
  const legacyTemplate = !project.agentConfig && AGENT_TEMPLATES.find(template =>
    project.model === template.model && project.systemPrompt === template.systemPrompt,
  )
  const agentConfig = project.agentConfig || (legacyTemplate && buildAgentConfig(legacyTemplate, legacyTemplate.skillIds[0]))
  const hasActiveSkillId = Object.prototype.hasOwnProperty.call(project, 'activeSkillId')
  const activeSkillId = hasActiveSkillId ? project.activeSkillId : agentConfig?.defaultSkillId

  return {
    ...project,
    ...(agentConfig ? { agentConfig } : {}),
    ...(!hasActiveSkillId && activeSkillId ? { activeSkillId } : {}),
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

export function resolveAgentReadiness({ agentConfig, connectedServerIds = [], enabledTools = [], serverCredentialStatuses = [], modelInfo, modelReady }) {
  const requiredMcpServerIds = agentConfig?.requiredMcpServerIds || []
  const connectedIds = new Set(connectedServerIds.map(server => typeof server === 'string' ? server : server.id))
  const missingMcpServerIds = requiredMcpServerIds.filter(id => !connectedIds.has(id))
  const enabledServerIds = new Set(enabledTools.map(tool => tool._serverId))
  const unavailableMcpServerIds = requiredMcpServerIds.filter(id => connectedIds.has(id) && !enabledServerIds.has(id))
  const credentialReadyByServerId = new Map(serverCredentialStatuses.map(status => [status.id, status.ready]))
  const missingMcpCredentialServerIds = requiredMcpServerIds.filter(id => connectedIds.has(id) && credentialReadyByServerId.get(id) === false)
  const requirements = agentConfig?.modelRequirements || {}
  const chatReady = modelReady === true
  const modelSupportsTools = !requirements.requiresToolSupport
    || requirements.supportedProviders?.includes(modelInfo?.provider) === true
  const toolsReady = chatReady && modelSupportsTools && unavailableMcpServerIds.length === 0 && missingMcpCredentialServerIds.length === 0

  return {
    chatReady,
    modelReady: chatReady,
    modelSupportsTools,
    toolsReady,
    ready: toolsReady && missingMcpServerIds.length === 0,
    missingMcpServerIds,
    unavailableMcpServerIds,
    missingMcpCredentialServerIds,
  }
}
