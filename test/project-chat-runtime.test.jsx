import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import i18n from '../src/i18n'
import ProjectChat from '../src/pages/ProjectChat'

const mocks = vi.hoisted(() => ({
  getProject: vi.fn(), getProjectMessages: vi.fn(), getConvMessages: vi.fn(), getProjectFiles: vi.fn(), getProjectConversations: vi.fn(),
  getConversation: vi.fn(), saveMessage: vi.fn(), saveProject: vi.fn(), updateProject: vi.fn(), updateConversation: vi.fn(),
  getConnectedServers: vi.fn(), getAllServerTools: vi.fn(), streamMessage: vi.fn(), getInstalledSkills: vi.fn(), getApiKeys: vi.fn(),
}))

vi.mock('../src/store/db', () => ({
  getProject: mocks.getProject, getProjectMessages: mocks.getProjectMessages, getConvMessages: mocks.getConvMessages,
  getProjectFiles: mocks.getProjectFiles, getProjectConversations: mocks.getProjectConversations, getConversation: mocks.getConversation,
  saveMessage: mocks.saveMessage, saveProject: mocks.saveProject, updateProject: mocks.updateProject, updateConversation: mocks.updateConversation,
  saveConversation: vi.fn(), deleteMessage: vi.fn(), deleteProjectMessages: vi.fn(), saveFile: vi.fn(), deleteConversation: vi.fn(),
}))

vi.mock('../src/lib/llm', () => ({
  MODELS: { 'claude-sonnet-4-6': { label: 'Claude', provider: 'claude', tag: 'Claude' } },
  DEFAULT_MODEL: 'claude-sonnet-4-6', streamMessage: mocks.streamMessage,
  generateProjectMeta: vi.fn(), generateKnowledgeUpdate: vi.fn(), consolidateKnowledge: vi.fn(),
  parseArtifacts: () => [], stripArtifacts: text => text, stripStreamingArtifacts: text => text,
  getOllamaModels: vi.fn().mockResolvedValue({}), getCompatibleModels: () => ({}),
  getApiKeys: mocks.getApiKeys, getCompatibleConfig: () => ({}),
}))

vi.mock('../src/lib/mcp', () => ({
  DEMO_SERVERS: [{ id: 'brave-search', name: 'Brave Search' }], getConnectedServers: mocks.getConnectedServers,
  getAllServerTools: mocks.getAllServerTools, executeTool: vi.fn(), getAllowRiskyTools: () => false,
}))
vi.mock('../src/lib/memory', () => ({ getMemory: vi.fn().mockResolvedValue(null), saveMemory: vi.fn(), triggerReflection: vi.fn(), calcReflectionScore: () => 0 }))
vi.mock('../src/lib/trigger', () => ({ checkTrigger: () => false, checkSemanticTrigger: vi.fn().mockResolvedValue({ isHighValue: false }) }))
vi.mock('../src/lib/intentDetector', () => ({ detectIntent: () => 'general' }))
vi.mock('../src/lib/contextBuilder', () => ({ buildProjectContext: () => '', buildContextSnapshot: () => ({}), describeInjection: () => '' }))
vi.mock('../src/lib/skills', () => ({ getInstalledSkills: mocks.getInstalledSkills, matchSkillsByMessage: () => [] }))
vi.mock('../src/lib/fileExtractor', () => ({ extractFileContent: vi.fn() }))
vi.mock('../src/lib/preferences', () => ({ getUserProfile: () => ({ name: 'Tester' }) }))
vi.mock('../src/components/ChatMessage', () => ({ default: () => null }))
vi.mock('../src/components/FilePanel', () => ({ default: () => null }))
vi.mock('../src/components/CreateProjectModal', () => ({ default: () => null }))
vi.mock('../src/components/SettingsModal', () => ({ default: () => null }))
vi.mock('../src/components/SearchModal', () => ({ default: () => null }))
vi.mock('../src/components/AIBrief', () => ({ default: () => null }))
vi.mock('../src/components/InputBar', () => ({ default: ({ onSend, disabled }) => <button disabled={disabled} onClick={() => onSend('研究主题')}>发送测试消息</button> }))

function chatTree() {
  return (
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/project/project-1']}>
        <Routes><Route path="/project/:id" element={<ProjectChat />} /></Routes>
      </MemoryRouter>
    </I18nextProvider>
  )
}

describe('ProjectChat agent runtime seam', () => {
  let connectedServers
  let availableTools

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn()
    connectedServers = [{ id: 'brave-search', name: 'Brave Search' }]
    availableTools = [{ _serverId: 'brave-search', name: 'web_search', risk: 'read' }]
    mocks.getProject.mockResolvedValue({
      id: 'project-1', name: '研究项目', knowledge: [], model: 'claude-sonnet-4-6', icon: '🔬', isTemp: false,
      agentConfig: {
        templateId: 'research-agent', systemPrompt: '项目模板提示词', defaultSkillId: 'persisted-research-skill',
        requiredMcpServerIds: ['brave-search'], modelRequirements: { requiresToolSupport: true, supportedProviders: ['claude'] },
      },
    })
    mocks.getProjectMessages.mockResolvedValue([])
    mocks.getConvMessages.mockResolvedValue([])
    mocks.getProjectFiles.mockResolvedValue([])
    mocks.getProjectConversations.mockResolvedValue([])
    mocks.getConversation.mockResolvedValue(null)
    mocks.getInstalledSkills.mockResolvedValue([{ id: 'persisted-research-skill', systemPrompt: '已安装技能提示词', name: '研究技能', icon: '🔬' }])
    mocks.getConnectedServers.mockImplementation(() => connectedServers)
    mocks.getAllServerTools.mockImplementation(() => availableTools)
    mocks.getApiKeys.mockReturnValue({ claude: 'configured-key', openai: '' })
    mocks.saveMessage.mockResolvedValue(undefined)
    mocks.saveProject.mockResolvedValue(undefined)
    mocks.streamMessage.mockImplementation(async ({ onDone }) => { await onDone('完成') })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('uses the canonical default skill prompt and the same current tool snapshot sent to the model', async () => {
    const view = render(chatTree())

    await waitFor(() => expect(screen.getByText('Agent 就绪')).toBeInTheDocument())
    fireEvent.click(screen.getByText('发送测试消息'))
    await waitFor(() => expect(mocks.streamMessage).toHaveBeenCalledTimes(1))
    expect(mocks.streamMessage.mock.calls[0][0].systemPrompt).toContain('已安装技能提示词')
    expect(mocks.streamMessage.mock.calls[0][0].tools).toEqual([{ _serverId: 'brave-search', name: 'web_search', risk: 'read' }])

    connectedServers = [{ id: 'github', name: 'GitHub' }]
    availableTools = [{ _serverId: 'github', name: 'search_repositories', risk: 'read' }]
    view.rerender(chatTree())

    await waitFor(() => expect(screen.getByText('缺少 MCP：brave-search')).toBeInTheDocument())
    fireEvent.click(screen.getByText('发送测试消息'))
    await waitFor(() => expect(mocks.streamMessage).toHaveBeenCalledTimes(2))
    expect(mocks.streamMessage.mock.calls[1][0].tools).toEqual([{ _serverId: 'github', name: 'search_repositories', risk: 'read' }])
  })

  it('does not show full agent readiness when the model key or required enabled tools are unavailable', async () => {
    mocks.getApiKeys.mockReturnValue({ claude: '', openai: '' })
    const firstView = render(chatTree())

    await waitFor(() => expect(screen.getByText('模型未就绪')).toBeInTheDocument())
    expect(screen.queryByText('Agent 就绪')).not.toBeInTheDocument()
    firstView.unmount()

    mocks.getApiKeys.mockReturnValue({ claude: 'configured-key', openai: '' })
    availableTools = []
    render(chatTree())

    await waitFor(() => expect(screen.getByText('MCP 工具不可用：brave-search')).toBeInTheDocument())
    expect(screen.queryByText('Agent 就绪')).not.toBeInTheDocument()
  })
})
