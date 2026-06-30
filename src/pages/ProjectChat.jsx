import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getProject, saveProject, updateProject, updateConversation, getProjectMessages, getConvMessages, getProjectConversations, saveConversation, saveMessage, deleteMessage, deleteProjectMessages, getProjectFiles, saveFile, getConversation, deleteConversation } from '../store/db'
import { streamMessage, generateProjectMeta, generateKnowledgeUpdate, consolidateKnowledge, MODELS, DEFAULT_MODEL, parseArtifacts, stripArtifacts, stripStreamingArtifacts, getOllamaModels, getCompatibleModels, getApiKeys, getCompatibleConfig } from '../lib/llm'
import { DEMO_SERVERS, getConnectedServers, getAllServerTools, executeTool } from '../lib/mcp'
import { getMemory, saveMemory, triggerReflection, calcReflectionScore } from '../lib/memory'
import { checkTrigger, checkSemanticTrigger } from '../lib/trigger'
import { detectIntent } from '../lib/intentDetector'
import { buildProjectContext, describeInjection } from '../lib/contextBuilder'
import { getInstalledSkills, matchSkillsByMessage } from '../lib/skills'
import { extractFileContent } from '../lib/fileExtractor'
import ChatMessage from '../components/ChatMessage'
import FilePanel from '../components/FilePanel'
import InputBar from '../components/InputBar'
import CreateProjectModal from '../components/CreateProjectModal'
import SettingsModal, { getUserProfile } from '../components/SettingsModal'
import SearchModal from '../components/SearchModal'
import AIBrief from '../components/AIBrief'
import { useTranslation } from 'react-i18next'

export default function ProjectChat() {
  const { t } = useTranslation()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { name: displayName = 'U' } = getUserProfile()

  const [project, setProject] = useState(null)
  const [messages, setMessages] = useState([])
  const [files, setFiles] = useState([])
  const [model, setModel] = useState(DEFAULT_MODEL)
  const [streaming, setStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [panelOpen, setPanelOpen] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [triggerShown, setTriggerShown] = useState(false)
  const [triggerReason, setTriggerReason] = useState('rounds')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [suggestedMeta, setSuggestedMeta] = useState({ name: '', status: '' })
  const [hasFileUploaded, setHasFileUploaded] = useState(false)
  const [error, setError] = useState('')
  const [skillSystemPrompt, setSkillSystemPrompt] = useState('')
  const [matchedSkills, setMatchedSkills] = useState([])
  const [installedSkills, setInstalledSkills] = useState([])
  const [isUnsaved, setIsUnsaved] = useState(false) // true = project exists only in state, not yet in DB
  const [mcpTools, setMcpTools] = useState([])
  const [toolStatus, setToolStatus] = useState('')
  const [memory, setMemory] = useState(null)
  const [reflectionRunning, setReflectionRunning] = useState(false)
  const [displayCount, setDisplayCount] = useState(50)
  const [ollamaModels, setOllamaModels] = useState({})
  const [compatibleModels, setCompatibleModels] = useState({})
  const [showVizSuggest, setShowVizSuggest] = useState(false)
  const [selectedVizTypes, setSelectedVizTypes] = useState([])
  const [showSearch, setShowSearch] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [activeSkillId, setActiveSkillId] = useState(null)
  const [lastIntent, setLastIntent] = useState(null)
  const [knowledgeSuggestion, setKnowledgeSuggestion] = useState(false)
  const [extractingKnowledge, setExtractingKnowledge] = useState(false)
  const [showSkillPicker, setShowSkillPicker] = useState(false)
  const [projectThreads, setProjectThreads] = useState([])

  const threadId = searchParams.get('thread') || null

  const messagesEndRef = useRef(null)
  const abortRef = useRef(null)
  const toolCallsRef = useRef([])
  const messagesRef = useRef([])
  const modelRef = useRef(DEFAULT_MODEL)
  const memoryRef = useRef(null)
  const projectRef = useRef(null)
  const initialMsgCountRef = useRef(0)

  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { modelRef.current = model }, [model])
  useEffect(() => { memoryRef.current = memory }, [memory])
  useEffect(() => { projectRef.current = project }, [project])

  useEffect(() => {
    function handleKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setShowSearch(true) }
      if (e.key === 'Escape' && panelOpen && !showSearch && !showSettings && !showCreateModal) {
        setPanelOpen(false)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [panelOpen, showSearch, showSettings, showCreateModal])

  useEffect(() => {
    loadData()
    getInstalledSkills().then(skills => {
      setInstalledSkills(skills)
    })
    const connected = getConnectedServers()
    setMcpTools(getAllServerTools(connected))
    getMemory(id).then(m => { if (m) setMemory(m) })
    getOllamaModels().then(setOllamaModels)
    setCompatibleModels(getCompatibleModels())
    return () => {
      abortRef.current?.abort()

      const msgs = messagesRef.current
      const proj = projectRef.current
      const aiCount = msgs.filter(m => m.role === 'assistant').length
      const newAiCount = aiCount - initialMsgCountRef.current

      if (aiCount >= 2) {
        const score = calcReflectionScore(msgs)
        if (score >= 50) triggerReflection(id, msgs, modelRef.current, memoryRef.current).catch(() => {})
      }

      // 本次会话新增 ≥ 4 条 AI 回复，且项目已持久化，自动更新 status
      if (newAiCount >= 4 && proj && !proj.isTemp) {
        const existingKnowledge = Array.isArray(proj.knowledge) ? proj.knowledge : []
        Promise.all([
          generateProjectMeta(msgs, modelRef.current),
          generateKnowledgeUpdate(msgs, existingKnowledge, modelRef.current),
        ]).then(([meta, newItems]) => {
          const knowledge = newItems ? [...existingKnowledge, ...newItems] : existingKnowledge
          const status = meta.status || meta.summary || ''
          if (status) updateProject(id, { status, knowledge, updatedAt: Date.now() }).catch(() => {})
        }).catch(() => {})
      }
    }
  }, [id, threadId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  async function loadData() {
    setMessages([])
    setStreaming(false)
    setStreamingText('')
    setError('')
    setTriggerShown(false)
    setKnowledgeSuggestion(false)
    setDisplayCount(50)
    const [proj, msgs, fls, threads] = await Promise.all([
      getProject(id),
      threadId ? getConvMessages(threadId) : getProjectMessages(id),
      getProjectFiles(id),
      getProjectConversations(id),
    ])
    setProjectThreads(threads)
    if (proj) {
      setProject(proj)
      setModel(proj.model || DEFAULT_MODEL)
      if (proj.activeSkillId) setActiveSkillId(proj.activeSkillId)
    } else {
      // 不立即写 DB，等用户发第一条消息才真正保存
      const now = Date.now()
      const newProj = {
        id, name: '新对话', status: '', knowledge: [],
        model: DEFAULT_MODEL, icon: '💬',
        createdAt: now, updatedAt: now,
        isTemp: true,
      }
      setProject(newProj)
      setIsUnsaved(true)
    }

    // 加载技能/模板的 system prompt
    const convId = searchParams.get('convId')
    if (convId) {
      const conv = await getConversation(convId)
      if (conv?.systemPrompt) setSkillSystemPrompt(conv.systemPrompt)
      if (conv?.model) setModel(conv.model)
    }

    setMessages(msgs)
    setFiles(fls)
    initialMsgCountRef.current = msgs.filter(m => m.role === 'assistant').length
  }

  function handleModelChange(modelId) {
    setModel(modelId)
    setProject(prev => prev ? { ...prev, model: modelId } : prev)
    const convId = searchParams.get('convId')
    if (!project?.isTemp && project?.id) {
      updateProject(project.id, { model: modelId })
    }
    if (convId) {
      updateConversation(convId, { model: modelId })
    }
  }

  async function handleSend(text) {
    if (!text.trim() || streaming) return
    setError('')

    // 第一条消息时才真正写入 DB
    if (isUnsaved && project) {
      await saveProject(project)
      setIsUnsaved(false)
      setProject(prev => prev ? { ...prev, isTemp: false } : prev)
    }

    const userMsg = {
      id: crypto.randomUUID(),
      projectId: id,
      ...(threadId && { convId: threadId }),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }
    await saveMessage(userMsg)

    // Auto-title thread from first user message
    if (threadId && messages.length === 0) {
      const title = text.trim().slice(0, 28) + (text.trim().length > 28 ? '…' : '')
      await updateConversation(threadId, { title, updatedAt: Date.now() })
      setProjectThreads(prev => prev.map(t => t.id === threadId ? { ...t, title } : t))
    }

    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    // Keep new message visible when paginating
    setDisplayCount(n => Math.max(n, updatedMessages.length))

    // Check trigger: only show for temp chats (not already a project)
    if (!triggerShown && project?.isTemp && checkTrigger(updatedMessages, hasFileUploaded)) {
      setTriggerReason(hasFileUploaded ? 'file' : 'rounds')
      setTriggerShown(true)
    }

    // Auto-match relevant skills from installed pool
    const currentMatchedSkills = installedSkills.length > 0
      ? matchSkillsByMessage(text, installedSkills).filter(s => s.id !== activeSkillId)
      : []
    setMatchedSkills(currentMatchedSkills)

    setStreaming(true)
    setStreamingText('')
    toolCallsRef.current = []

    const artifactInstruction = `\n\n当用户需要文档、报告、流程图、脑图或甘特图时，在正文回复之后，用以下格式输出产出物（不要放在正文中间）：

<artifact type="document" title="文档标题">
# 一级标题

正文段落，支持 **加粗**、*斜体*、\`代码\`。

## 二级标题

- 列表项 1
- 列表项 2
</artifact>

<artifact type="flowchart" title="流程图标题">
graph TD
  A[开始] --> B{判断}
  B -->|是| C[处理]
  B -->|否| D[结束]
  C --> D
</artifact>

<artifact type="mindmap" title="脑图标题">
# 核心主题
## 分支一
### 子项 A
### 子项 B
## 分支二
### 子项 C
### 子项 D
</artifact>

<artifact type="gantt" title="项目甘特图">
gantt
  title 项目计划
  dateFormat YYYY-MM-DD
  section 阶段一
    需求分析 :a1, 2024-01-01, 7d
    方案设计 :a2, after a1, 5d
  section 阶段二
    开发实现 :b1, after a2, 14d
    测试验证 :b2, after b1, 7d
</artifact>

规则：
- flowchart 使用 Mermaid 语法（graph TD / graph LR）
- mindmap 使用 Markdown 大纲格式（# 主题 / ## 分支 / ### 子项），**不要**使用 Mermaid mindmap 语法
- gantt 使用 Mermaid gantt 语法，dateFormat YYYY-MM-DD，用 after 语法表达依赖关系
- document 使用 Markdown 格式，内容要完整详细
- 只在用户明确需要时才生成产出物`

    // 意图感知：按用户意图决定注入哪些项目上下文，自动匹配的技能 prompt 一并注入
    const intent = detectIntent(text)
    setLastIntent(intent)

    const activePinnedSkill = installedSkills.find(s => s.id === activeSkillId)
    const basePrompt = activePinnedSkill?.systemPrompt || skillSystemPrompt || '你是一位专业的 AI 助理，正在帮助用户完成工作。'

    const projectContext = buildProjectContext(intent, project, memory, currentMatchedSkills, text)
    const uploadedTextFiles = files.filter(f => f.source === 'upload' && f.content)
    const uploadedImages = files.filter(f => f.source === 'upload' && f.imageData)

    const fileContext = uploadedTextFiles.length > 0
      ? '\n\n---\n[用户上传的参考文件]\n' + uploadedTextFiles.map(f =>
          `【文件：${f.name}】\n${f.content.slice(0, 40000)}`
        ).join('\n\n')
      : ''

    const systemPrompt = projectContext
      ? `${projectContext}\n\n${basePrompt}${artifactInstruction}${fileContext}`
      : `${basePrompt}${artifactInstruction}${fileContext}`

    // Inject artifact content into history so AI can read context
    const messagesForApi = updatedMessages.map((m, idx) => {
      const docs = (m.artifacts || []).filter(a => a.type === 'document' && a.content)
      const charts = (m.artifacts || []).filter(a => a.type !== 'document' && (a.code || a.content))
      const docText = docs.map(a => `[文档「${a.title}」]\n${a.content}`).join('\n\n')
      const typeLabel = { flowchart: '流程图', mindmap: '脑图', gantt: '甘特图' }
      const chartNote = charts.map(a => `[已生成${typeLabel[a.type] || a.type}「${a.title}」]`).join('\n')
      const extra = [docText, chartNote].filter(Boolean).join('\n\n')
      const baseText = ((m.content || '') + (extra ? '\n\n' + extra : '')).trim()
      // Assistant messages with empty content (artifact-only responses) must have fallback
      // to avoid API rejecting the request with a validation error on subsequent turns
      const finalContent = baseText || (m.role === 'assistant' ? '[已完成]' : m.content || ' ')

      // Inject images into the last user message only (Vision API)
      const isLastUserMsg = m.role === 'user' && idx === updatedMessages.length - 1
      if (isLastUserMsg && uploadedImages.length > 0) {
        const content = [
          ...uploadedImages.map(f => ({
            type: 'image',
            source: { type: 'base64', media_type: f.imageData.mediaType, data: f.imageData.data },
          })),
          { type: 'text', text: finalContent },
        ]
        return { ...m, content }
      }

      return finalContent !== m.content ? { ...m, content: finalContent } : m
    })

    const controller = new AbortController()
    abortRef.current = controller

    await streamMessage({
      model,
      messages: messagesForApi,
      systemPrompt,
      tools: mcpTools,
      signal: controller.signal,
      onToolStatus: (status) => setToolStatus(status),
      onToolCall: async (toolName, toolInput) => {
        const toolDef = mcpTools.find(t => t.name === toolName)
        if (!toolDef) return '未找到对应工具'
        const serverDef = DEMO_SERVERS.find(s => s.id === toolDef._serverId)
        toolCallsRef.current.push({ serverId: toolDef._serverId, serverName: serverDef?.name || toolDef._serverId, toolName })
        return executeTool(toolDef._serverId, toolName, toolInput)
      },
      onChunk: (_, full) => {
        setToolStatus('')
        setStreamingText(full)
      },
      onDone: async (full) => {
        abortRef.current = null
        const artifacts = parseArtifacts(full)
        const cleanContent = stripArtifacts(full)
        const assistantMsg = {
          id: crypto.randomUUID(),
          projectId: id,
          ...(threadId && { convId: threadId }),
          role: 'assistant',
          content: cleanContent,
          artifacts,
          toolCalls: toolCallsRef.current.length > 0 ? [...toolCallsRef.current] : undefined,
          model,
          timestamp: Date.now(),
        }
        await saveMessage(assistantMsg)
        setMessages(prev => [...prev, assistantMsg])
        setStreamingText('')
        setToolStatus('')
        setStreaming(false)

        const now = Date.now()
        const updated = { ...project, updatedAt: now }
        await saveProject(updated)
        setProject(updated)

        // Update thread preview on each AI reply
        if (threadId) {
          const preview = cleanContent.replace(/\s+/g, ' ').trim().slice(0, 80)
          updateConversation(threadId, { preview, updatedAt: now })
          setProjectThreads(prev => prev.map(t => t.id === threadId ? { ...t, preview, updatedAt: now } : t))
        }

        // 反思触发：每满 5 条 AI 回复，评分 ≥ 60 则后台触发
        const allMsgs = [...updatedMessages, assistantMsg]
        const aiCount = allMsgs.filter(m => m.role === 'assistant').length
        if (!project?.isTemp && aiCount > 0 && aiCount % 5 === 0 && !reflectionRunning) {
          const score = calcReflectionScore(allMsgs)
          if (score >= 60) {
            setReflectionRunning(true)
            triggerReflection(id, allMsgs, model, memory)
              .then(m => { if (m) setMemory(m) })
              .catch(() => {})
              .finally(() => setReflectionRunning(false))
          }
        }

        // 第一轮对话完成后自动命名
        if (allMsgs.length === 2 && (project.name === '新项目' || project.name === '新对话')) {
          generateProjectMeta(allMsgs, model)
            .then(meta => {
              if (meta.name && meta.name !== '新项目') {
                const cur = projectRef.current
                const titled = { ...cur, name: meta.name, status: meta.status || meta.summary || cur.status || '', isTemp: false, updatedAt: Date.now() }
                saveProject(titled)
                setProject(titled)
              }
            })
            .catch(() => {})
        }

        // 可视化提示：非临时项目，首次达到 8 条 AI 回复时提示
        if (!showVizSuggest && !project?.isTemp && aiCount === 8) {
          setShowVizSuggest(true)
        }

        // 语义触发（临时对话）：3 轮后检测 AI 回复是否包含高价值内容 → 提示建项目
        if (!triggerShown && project?.isTemp && allMsgs.length >= 6) {
          checkSemanticTrigger(cleanContent).then(result => {
            if (result.isHighValue) {
              setTriggerReason('semantic')
              setTriggerShown(true)
            }
          }).catch(() => {})
        }

        // 语义触发（持久化项目）：每 3 轮检测一次，发现高价值内容 → 提示提取到知识库
        if (!project?.isTemp && aiCount > 0 && aiCount % 3 === 0 && !knowledgeSuggestion) {
          checkSemanticTrigger(cleanContent).then(result => {
            if (result.isHighValue) setKnowledgeSuggestion(true)
          }).catch(() => {})
        }
      },
      onError: (err) => {
        abortRef.current = null
        setError(err)
        setStreaming(false)
        setStreamingText('')
        setToolStatus('')
      },
    })
  }

  async function handleEditMessage(msgId, newText) {
    const idx = messages.findIndex(m => m.id === msgId)
    if (idx === -1) return
    const toDelete = messages.slice(idx)
    setMessages(messages.slice(0, idx))
    await Promise.all(toDelete.map(m => deleteMessage(m.id)))
    await handleSend(newText)
  }

  async function handleConsolidateKnowledge() {
    const existing = Array.isArray(project?.knowledge) ? project.knowledge : []
    if (existing.length === 0) return
    const consolidated = await consolidateKnowledge(existing, model)
    if (consolidated && consolidated !== existing) {
      const updated = { ...project, knowledge: consolidated, updatedAt: Date.now() }
      await saveProject(updated)
      setProject(updated)
    }
  }

  async function handleExtractKnowledge() {
    if (extractingKnowledge || !project) return
    setExtractingKnowledge(true)
    try {
      const existing = Array.isArray(project.knowledge) ? project.knowledge : []
      const newItems = await generateKnowledgeUpdate(messages, existing, model)
      if (newItems) {
        const updated = { ...project, knowledge: [...existing, ...newItems], updatedAt: Date.now() }
        await saveProject(updated)
        setProject(updated)
      }
    } finally {
      setExtractingKnowledge(false)
      setKnowledgeSuggestion(false)
    }
  }

  async function handleRegenerate(msgId) {
    const idx = messages.findIndex(m => m.id === msgId)
    if (idx === -1) return
    const prevUserMsg = messages.slice(0, idx).reverse().find(m => m.role === 'user')
    if (!prevUserMsg) return
    const toDelete = messages.slice(idx)
    setMessages(messages.slice(0, idx))
    await Promise.all(toDelete.map(m => deleteMessage(m.id)))
    await handleSend(prevUserMsg.content)
  }

  async function handleFileUpload(file) {
    setHasFileUploaded(true)
    const id2 = crypto.randomUUID()

    const { content, imageData } = await extractFileContent(file)

    const f = {
      id: id2, projectId: id,
      name: file.name,
      type: 'upload', source: 'upload',
      meta: `${(file.size / 1024).toFixed(0)}KB`,
      content: content || null,
      imageData: imageData || null,
      createdAt: Date.now(),
    }
    await saveFile(f)
    setFiles(prev => [f, ...prev])

    if (!triggerShown) {
      setTriggerShown(true)
    }
  }

  async function handleArtifactUpdate(msgId, artifactId, changes) {
    const updated = messages.map(m => {
      if (m.id !== msgId) return m
      return { ...m, artifacts: m.artifacts.map(a => a.id === artifactId ? { ...a, ...changes } : a) }
    })
    setMessages(updated)
    const msg = updated.find(m => m.id === msgId)
    if (msg) await saveMessage(msg)
  }

  async function handleSaveArtifact(artifact) {
    const f = {
      id: artifact.id || crypto.randomUUID(),
      projectId: id,
      name: artifact.title,
      type: artifact.type, source: 'ai',
      code: artifact.code || null,
      content: artifact.content || null,
      createdAt: Date.now(),
    }
    await saveFile(f)
    setFiles(prev => [f, ...prev])
  }

  async function handleGenerateSummary() {
    if (messages.length < 2) return
    const existing = Array.isArray(project?.knowledge) ? project.knowledge : []
    const [meta, newItems] = await Promise.all([
      generateProjectMeta(messages, model),
      generateKnowledgeUpdate(messages, existing, model),
    ])
    const knowledge = newItems ? [...existing, ...newItems] : existing
    const updated = { ...project, status: meta.status || meta.summary || '', knowledge, updatedAt: Date.now() }
    await saveProject(updated)
    setProject(updated)
  }

  async function handleManualReflect() {
    if (reflectionRunning || messages.length < 4) return
    setReflectionRunning(true)
    try {
      const m = await triggerReflection(id, messages, model, memory)
      if (m) setMemory(m)
    } catch {}
    finally { setReflectionRunning(false) }
  }

  async function handleMemoryEdit(content) {
    const now = Date.now()
    const updated = {
      ...(memory || {}),
      projectId: id,
      content,
      version: memory?.version || 0,
      snapshot: memory?.snapshot || '',
      updatedAt: now,
      createdAt: memory?.createdAt || now,
    }
    await saveMemory(updated)
    setMemory(updated)
  }

  async function handleNewNote() {
    const noteMsg = {
      id: crypto.randomUUID(),
      projectId: id,
      ...(threadId ? { convId: threadId } : {}),
      role: 'assistant',
      content: project?.isTemp ? '已创建空白笔记，点击下方卡片即可编辑。' : '已创建空白笔记，可在右侧产出物面板中编辑。',
      artifacts: [{
        id: crypto.randomUUID(),
        type: 'document',
        title: '新笔记',
        content: '# 新笔记\n\n在这里记录内容…',
      }],
      model: 'system',
      timestamp: Date.now(),
    }
    await saveMessage(noteMsg)
    setMessages(prev => [...prev, noteMsg])
  }

  async function handleCommand(cmd) {
    if (cmd === 'summary') {
      await handleGenerateSummary()
    } else if (cmd === 'project') {
      await handleCreateProject()
    } else if (cmd === 'clear') {
      if (window.confirm('确定要清空当前对话的所有消息吗？此操作不可撤销。')) {
        await deleteProjectMessages(id)
        setMessages([])
        setMatchedSkills([])
        setTriggerShown(false)
      }
    } else if (cmd === 'memory') {
      setPanelOpen(true)
    } else if (cmd === 'settings') {
      setShowSettings(true)
    } else if (cmd === 'go-skills') {
      navigate('/skills')
    }
  }

  async function handleCreateProject() {
    setShowCreateModal(true)
    setCreateLoading(true)
    try {
      const meta = await generateProjectMeta(messages, model)
      setSuggestedMeta(meta)
    } catch {
      setSuggestedMeta({ name: project?.name || '新项目', status: '' })
    } finally {
      setCreateLoading(false)
    }
  }

  async function handleConfirmCreate({ name, summary }) {
    const now = Date.now()
    const updated = {
      ...project,
      name,
      status: summary || '',  // CreateProjectModal 传来的 summary 字段在这里用作 status
      isTemp: false,
      updatedAt: now,
    }
    await saveProject(updated)
    setProject(updated)
    setShowCreateModal(false)
    setTriggerShown(false)
  }

  async function handleActivateSkill(skillId) {
    setActiveSkillId(skillId)
    if (!project?.isTemp && project?.id) {
      await updateProject(project.id, { activeSkillId: skillId })
    }
  }

  async function handleDeactivateSkill() {
    setActiveSkillId(null)
    if (!project?.isTemp && project?.id) {
      await updateProject(project.id, { activeSkillId: null })
    }
  }

  async function handleNewThread() {
    if (project?.isTemp) return
    const now = Date.now()
    const newThread = {
      id: crypto.randomUUID(),
      projectId: id,
      title: '新对话',
      preview: '',
      createdAt: now,
      updatedAt: now,
    }
    await saveConversation(newThread)
    setProjectThreads(prev => [newThread, ...prev])
    navigate(`/project/${id}?thread=${newThread.id}`)
  }

  async function handleDeleteThread(tId) {
    await deleteConversation(tId)
    setProjectThreads(prev => prev.filter(t => t.id !== tId))
    if (threadId === tId) navigate(`/project/${id}`)
  }

  // 从消息字符数估算 token 用量（1 token ≈ 2.5 中文字符，基准 100K token 窗口）
  const estimatedChars = messages.reduce((sum, m) => sum + (m.content?.length || 0), 0)
  const TOKEN_WINDOW = 200000
  const tokenPercent = Math.min(99, Math.round(estimatedChars / (TOKEN_WINDOW * 2.5) * 100))

  function renderSkillBar() {
    const allModels = { ...MODELS, ...ollamaModels, ...compatibleModels }
    const keys = getApiKeys()
    const compatCfg = getCompatibleConfig()
    const modelInfo = allModels[model]
    const modelReady = !modelInfo
      ? true
      : modelInfo.provider === 'claude' ? !!keys.claude
      : modelInfo.provider === 'openai' ? !!keys.openai
      : modelInfo.provider === 'compatible' ? !!compatCfg.key
      : true

    const activeSkill = installedSkills.find(s => s.id === activeSkillId) || null
    // Show: project-default skill first, then auto-matched (deduplicated)
    const autoChips = matchedSkills.slice(0, activeSkill ? 2 : 3)
    const hasAnySkill = activeSkill || autoChips.length > 0

    return (
      <div style={{
        height: 38, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
        padding: '0 16px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-surface)', position: 'relative',
      }}>
        {/* 技能区 — 只读展示 + 持久化项目可绑定默认技能 */}
        {hasAnySkill && (
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', flexShrink: 0, letterSpacing: '0.02em' }}>技能</span>
        )}

        {/* 项目默认技能（可点击更换） */}
        {activeSkill ? (
          <div
            onClick={() => !project?.isTemp && setShowSkillPicker(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '2px 8px', borderRadius: 5, flexShrink: 0,
              background: 'var(--accent-glow)', border: '1px solid var(--accent-border)',
              fontSize: 10, fontWeight: 600, color: 'var(--accent)',
              cursor: project?.isTemp ? 'default' : 'pointer',
            }}
            title="点击更换项目默认技能"
          >
            <span>{activeSkill.icon}</span>
            <span>{activeSkill.name}</span>
            {!project?.isTemp && <span style={{ opacity: 0.6, fontSize: 9 }}>▾</span>}
          </div>
        ) : !project?.isTemp && installedSkills.length > 0 && (
          <button
            onClick={() => setShowSkillPicker(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 3,
              padding: '2px 8px', borderRadius: 5, flexShrink: 0,
              background: 'none', border: '1px dashed var(--border)',
              fontSize: 10, color: 'var(--text-muted)', cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
            title="绑定项目默认技能"
          >
            <span>✦</span>
            <span>{t('chat.bindSkill')}</span>
          </button>
        )}

        {/* 技能选择浮层 */}
        {showSkillPicker && !project?.isTemp && (
          <SkillPickerPopover
            skills={installedSkills}
            activeSkillId={activeSkillId}
            onSelect={(sid) => { handleActivateSkill(sid); setShowSkillPicker(false) }}
            onClear={() => { handleDeactivateSkill(); setShowSkillPicker(false) }}
            onClose={() => setShowSkillPicker(false)}
          />
        )}

        {/* 自动匹配技能（本条消息命中，只读） */}
        {autoChips.map(skill => (
          <div key={skill.id} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', borderRadius: 5, flexShrink: 0,
            background: 'var(--bg-hover)', border: '1px solid var(--border)',
            fontSize: 10, color: 'var(--text-muted)',
          }} title="自动匹配">
            <span>{skill.icon}</span>
            <span>{skill.name}</span>
          </div>
        ))}

        <div style={{ flex: 1 }} />

        {/* Context injection label — shows what context was sent last time */}
        {lastIntent && !project?.isTemp && (() => {
          const label = describeInjection(lastIntent, project)
          if (!label) return null
          return (
            <span style={{
              fontSize: 9, color: 'var(--text-muted)',
              padding: '2px 7px', borderRadius: 4,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              fontFamily: 'var(--font-mono)', letterSpacing: '0.02em', flexShrink: 0,
            }} title="上次发送时注入的项目上下文">
              ⊙ {label}
            </span>
          )
        })()}

        {/* Model selector with API key indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {!modelReady && (
            <span
              onClick={() => setShowSettings(true)}
              style={{
                fontSize: 9, color: 'var(--amber)', padding: '2px 6px', borderRadius: 4,
                background: 'var(--amber-bg)', border: '1px solid var(--amber-border)',
                cursor: 'pointer',
              }}
              title="未配置 API Key，点击去设置"
            >
              未配置 Key
            </span>
          )}
          <span style={{
            width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
            background: modelReady ? 'var(--green, #22c55e)' : 'var(--amber, #f59e0b)',
            display: 'inline-block',
          }} />
          <select
            value={model}
            onChange={e => handleModelChange(e.target.value)}
            style={{ fontSize: 10, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', outline: 'none' }}
          >
            {Object.entries(allModels).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
      </div>
    )
  }

  const isElectron = !!window.electronAPI
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--bg-base)', position: 'relative', zIndex: 1 }}>

      {/* ── Titlebar ── */}
      <div style={{
        height: 50, flexShrink: 0, position: 'relative',
        background: 'var(--bg-titlebar)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', padding: '0 16px',
        WebkitAppRegion: 'drag',
      }}>
        {/* Traffic light safe zone (Electron hiddenInset shows native buttons) */}
        <div style={{ width: isElectron ? 72 : 4, flexShrink: 0, WebkitAppRegion: 'no-drag' }} />

        {/* Centered breadcrumb */}
        <div style={{
          position: 'absolute', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 7,
          WebkitAppRegion: 'no-drag',
          fontFamily: 'var(--font-ui)',
        }}>
          <span
            onClick={() => navigate('/')}
            style={{ fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 500, transition: 'color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            {project?.isTemp ? '对话' : '项目'}
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: 10, opacity: 0.6 }}>›</span>

          {/* Icon picker */}
          {project && !project.isTemp && (
            <span style={{ position: 'relative' }}>
              <span
                onClick={() => setShowIconPicker(v => !v)}
                title="更换图标"
                style={{ fontSize: 15, cursor: 'pointer', userSelect: 'none', lineHeight: 1, padding: '2px 3px', borderRadius: 4, transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {project?.icon || '📁'}
              </span>
              {showIconPicker && (
                <EmojiPicker
                  onSelect={async (emoji) => {
                    const updated = { ...project, icon: emoji, updatedAt: Date.now() }
                    await saveProject(updated)
                    setProject(updated)
                    setShowIconPicker(false)
                  }}
                  onClose={() => setShowIconPicker(false)}
                />
              )}
            </span>
          )}

          {/* Project name (editable) */}
          {editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              onBlur={async () => {
                const name = titleDraft.trim()
                if (name && name !== project?.name) {
                  const updated = { ...project, name, updatedAt: Date.now() }
                  await saveProject(updated)
                  setProject(updated)
                }
                setEditingTitle(false)
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') e.currentTarget.blur()
                if (e.key === 'Escape') setEditingTitle(false)
              }}
              style={{
                background: 'var(--bg-card)', border: '1px solid var(--accent)',
                borderRadius: 6, padding: '2px 8px', fontSize: 13, fontWeight: 700,
                color: 'var(--text-primary)', outline: 'none', width: 180,
                fontFamily: 'var(--font-ui)',
              }}
            />
          ) : (
            <span
              style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', cursor: project && !project.isTemp ? 'text' : 'default' }}
              onClick={() => { if (project && !project.isTemp) { setTitleDraft(project.name); setEditingTitle(true) } }}
              title={project && !project.isTemp ? '点击重命名' : undefined}
            >
              {project?.name || '加载中…'}
            </span>
          )}

          {/* Status badge */}
          {project && !project.isTemp && (() => {
            const isArchived = project.archived
            const isRecent = project.updatedAt && (Date.now() - project.updatedAt < 7 * 24 * 60 * 60 * 1000)
            const label = isArchived ? t('projectCard.archived') : isRecent ? t('projectCard.active') : t('projectCard.paused')
            const color = isArchived ? 'var(--amber)' : isRecent ? 'var(--green)' : 'var(--amber)'
            const bg = isArchived ? 'rgba(251,191,36,0.08)' : isRecent ? 'rgba(52,211,153,0.08)' : 'rgba(251,191,36,0.08)'
            const border = isArchived ? 'rgba(251,191,36,0.2)' : isRecent ? 'rgba(52,211,153,0.2)' : 'rgba(251,191,36,0.2)'
            return (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: bg, border: `1px solid ${border}`,
                borderRadius: 4, padding: '1px 6px',
                fontFamily: 'var(--font-mono)', fontSize: 9, color, letterSpacing: '0.05em',
              }}>
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: color }} />
                {label}
              </div>
            )
          })()}
        </div>

        {/* Right buttons */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, WebkitAppRegion: 'no-drag' }}>
          {[
            { icon: '⌕', label: t('nav.search'), onClick: () => setShowSearch(true), active: false, show: true },
            { icon: '⚙', label: t('nav.settings'), onClick: () => setShowSettings(true), active: false, show: true },
            { icon: '⊞', label: panelOpen ? t('nav.hidePanel') : t('nav.showPanel'), onClick: () => setPanelOpen(v => !v), active: panelOpen, show: !project?.isTemp },
          ].filter(b => b.show).map(b => (
            <button
              key={b.label}
              onClick={b.onClick}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                height: 30, padding: '0 10px', borderRadius: 7,
                border: `1px solid ${b.active ? 'var(--accent-border)' : 'var(--border)'}`,
                background: b.active ? 'var(--accent-dim)' : 'var(--bg-card)',
                color: b.active ? 'var(--accent-raw)' : 'var(--text-muted)',
                cursor: 'pointer', fontSize: 11, fontWeight: 500,
                fontFamily: 'var(--font-ui)', transition: 'all 0.15s', flexShrink: 0,
              }}
              onMouseEnter={e => { if (!b.active) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border-strong)' } }}
              onMouseLeave={e => { if (!b.active) { e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' } }}
            >
              <span style={{ fontSize: 14, lineHeight: 1 }}>{b.icon}</span>
              <span>{b.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Sidebar — only for persisted projects */}
        {project && !project.isTemp && (
          <aside style={{
            width: 196, minWidth: 196, flexShrink: 0,
            background: 'var(--bg-panel)',
            backdropFilter: 'blur(8px)',
            borderRight: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            {/* Conversations list */}
            <div style={{ padding: '14px 8px 4px', flex: '0 0 auto' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0 8px', marginBottom: 6 }}>
                {t('chat.thisProject')}
              </div>
              <div>
                <SidebarThread
                  label={project.name}
                  isActive={!threadId}
                  onClick={() => navigate(`/project/${id}`)}
                />
                {projectThreads.map(th => (
                  <SidebarThread
                    key={th.id}
                    label={th.title || t('chat.newThread')}
                    preview={th.preview}
                    isActive={threadId === th.id}
                    onClick={() => navigate(`/project/${id}?thread=${th.id}`)}
                    onDelete={() => handleDeleteThread(th.id)}
                  />
                ))}
                <button
                  onClick={handleNewThread}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, width: '100%', marginTop: 2, padding: '5px 8px', borderRadius: 5, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text-muted)', transition: 'all 0.15s', textAlign: 'left' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)' }}
                >
                  <span style={{ fontSize: 13, lineHeight: 1 }}>+</span>
                  <span>{t('chat.newThread')}</span>
                </button>
              </div>
            </div>

            {/* Nav links — only workspace-level navigation */}
            <div style={{ padding: '14px 8px 4px', flex: '0 0 auto' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0 8px', marginBottom: 6 }}>
                {t('nav.workbench')}
              </div>
              {[
                { icon: '⊞', label: t('nav.overview'), path: '/', active: false },
                { icon: '◈', label: t('nav.projects'), path: null, active: true },
              ].map(item => (
                <div
                  key={item.label}
                  onClick={() => item.path && navigate(item.path)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 8px', borderRadius: 6, cursor: item.path ? 'pointer' : 'default',
                    fontSize: 12, fontWeight: 500,
                    fontFamily: 'var(--font-ui)',
                    transition: 'background 0.1s, color 0.1s',
                    background: item.active ? 'var(--accent-dim)' : 'transparent',
                    border: item.active ? '1px solid var(--accent-border)' : '1px solid transparent',
                    color: item.active ? 'var(--accent-raw)' : 'var(--text-secondary)',
                    marginBottom: 1,
                  }}
                  onMouseEnter={e => { if (!item.active) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)' } }}
                  onMouseLeave={e => { if (!item.active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' } }}
                >
                  <span style={{ fontSize: 11, width: 16, textAlign: 'center', opacity: 0.8 }}>{item.icon}</span>
                  {item.label}
                </div>
              ))}
            </div>

            {/* Footer — spacer + user row */}
            <div style={{ marginTop: 'auto', padding: '10px 8px', borderTop: '1px solid var(--border)' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 8px', borderRadius: 6, cursor: 'pointer', transition: 'background 0.1s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{
                  width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                  background: 'linear-gradient(135deg, var(--accent-raw), var(--cyan))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 700, color: 'white',
                  fontFamily: 'var(--font-ui)',
                  boxShadow: '0 0 8px rgba(61,142,245,0.25)',
                }}>{(displayName || 'U').charAt(0).toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>{displayName}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {getUserProfile().role || 'ContextOS'}
                  </div>
                </div>
              </div>
            </div>
          </aside>
        )}

        {/* ── Chat col + File panel ── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Chat column */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, borderRight: panelOpen && !project?.isTemp ? '1px solid var(--border)' : 'none' }}>

            {renderSkillBar()}

            {/* Messages scroll area */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

              {/* AI Brief — shown when project has messages */}
              {messages.length > 0 && !project?.isTemp && (
                <AIBrief project={project} msgCount={messages.length} onSend={handleSend} />
              )}

              <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>

                {/* Empty state */}
                {messages.length === 0 && !streaming && (
                  <div style={{ textAlign: 'center', padding: '80px 0', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontSize: 36, marginBottom: 14, color: 'var(--accent)' }}>✦</div>
                    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
                      {t('chat.startTitle')}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      {t('chat.startHint')}
                    </div>
                  </div>
                )}

                {/* Load more */}
                {messages.length > displayCount && (
                  <button
                    onClick={() => setDisplayCount(n => n + 50)}
                    style={{
                      alignSelf: 'center', fontSize: 11, padding: '5px 14px',
                      borderRadius: 8, cursor: 'pointer',
                      background: 'var(--bg-hover)', color: 'var(--text-muted)',
                      border: '1px solid var(--border)', transition: 'all 0.15s', fontFamily: 'var(--font-mono)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                  >
                    {t('chat.loadMore', { count: messages.length - displayCount })}
                  </button>
                )}

                {/* Messages */}
                {messages.slice(-displayCount).map(msg => (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    onSaveArtifact={handleSaveArtifact}
                    onArtifactUpdate={handleArtifactUpdate}
                    onEdit={!streaming ? handleEditMessage : undefined}
                    onRegenerate={!streaming ? handleRegenerate : undefined}
                    onRequestAiEdit={!streaming ? handleSend : undefined}
                  />
                ))}

                {/* Streaming */}
                {streaming && (
                  <div style={{ display: 'flex', gap: 9, alignSelf: 'flex-start', width: '100%' }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: 6, flexShrink: 0, marginTop: 2,
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, color: 'var(--accent)',
                    }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 5, fontWeight: 500 }}>ContextOS AI</div>
                      <div style={{
                        padding: '10px 14px', borderRadius: '10px 10px 10px 2px',
                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                        fontSize: 13, lineHeight: 1.65, color: 'var(--text-primary)',
                      }}>
                        {toolStatus ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--accent)' }}>
                            <span style={{ animation: 'spin 1.2s linear infinite', display: 'inline-block' }}>⚙</span>
                            {toolStatus}
                          </span>
                        ) : streamingText ? (
                          <div className="md">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {stripStreamingArtifacts(streamingText)}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                            {[0, 0.2, 0.4].map((delay, i) => (
                              <span key={i} style={{
                                width: 5, height: 5, borderRadius: '50%',
                                background: 'var(--accent)', display: 'inline-block',
                                animation: `pulse-dot 1.2s ease-in-out ${delay}s infinite`,
                              }} />
                            ))}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div style={{
                    padding: '12px 16px', borderRadius: 12,
                    background: 'var(--red-bg)', border: '1px solid var(--red-border)',
                    fontSize: 13, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <span style={{ flex: 1 }}>⚠️ {error}</span>
                    {error.includes('API Key') && (
                      <button
                        onClick={() => setShowSettings(true)}
                        style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 7, cursor: 'pointer', border: '1px solid var(--red-border)', background: 'var(--red-bg)', color: 'var(--red)' }}
                      >打开设置</button>
                    )}
                  </div>
                )}

                {/* Upgrade to project trigger — temp chats only */}
                {triggerShown && !showCreateModal && project?.isTemp && (
                  <div style={{
                    background: 'var(--accent-glow)', border: '1px solid var(--border)',
                    borderRadius: 12, padding: '12px 16px',
                    display: 'flex', alignItems: 'center', gap: 12,
                    fontSize: 13, color: 'var(--text-secondary)',
                  }}>
                    <span style={{ fontSize: 18 }}>✦</span>
                    <span>{
                      triggerReason === 'semantic'
                        ? '刚才产生了一个值得沉淀的结论，是否存入项目？'
                        : triggerReason === 'file'
                          ? '你上传了文件，是否创建项目统一管理？'
                          : '这个话题已有一定深度，是否创建项目以便持续积累上下文？'
                    }</span>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button
                        onClick={handleCreateProject}
                        style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, cursor: 'pointer', background: 'var(--accent)', color: 'white', border: 'none', fontWeight: 600 }}
                      >创建项目</button>
                      <button
                        onClick={() => setTriggerShown(false)}
                        style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                      >稍后</button>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Knowledge extraction banner */}
            {knowledgeSuggestion && !project?.isTemp && (
              <div style={{
                padding: '8px 20px',
                background: 'var(--bg-card)',
                borderTop: '1px solid var(--cyan-border)',
                display: 'flex', alignItems: 'center', gap: 10,
                fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0,
              }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>🧠</span>
                <span style={{ flex: 1 }}>AI 刚给出了值得沉淀的结论，提取到项目知识库？</span>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={handleExtractKnowledge}
                    disabled={extractingKnowledge}
                    style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, cursor: extractingKnowledge ? 'default' : 'pointer', background: 'var(--cyan)', color: 'var(--bg-base)', border: 'none', fontWeight: 600, opacity: extractingKnowledge ? 0.6 : 1 }}
                  >
                    {extractingKnowledge ? '提取中…' : '提取'}
                  </button>
                  <button
                    onClick={() => setKnowledgeSuggestion(false)}
                    style={{ fontSize: 11, padding: '4px 9px', borderRadius: 5, cursor: 'pointer', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                  >忽略</button>
                </div>
              </div>
            )}

            {showVizSuggest && (
              <VizSuggestBanner
                selectedTypes={selectedVizTypes}
                onToggle={(vid) => setSelectedVizTypes(prev =>
                  prev.includes(vid) ? prev.filter(v => v !== vid) : [...prev, vid]
                )}
                onGenerate={() => {
                  if (selectedVizTypes.length === 0) return
                  const VIZ_PROMPTS = {
                    mindmap:   '生成一个脑图（mindmap artifact，# / ## / ### Markdown 格式），梳理对话的核心结构和关键观点',
                    flowchart: '生成一个流程图（flowchart artifact，graph TD Mermaid 格式），描述对话涉及的关键流程或决策路径',
                    notes:     '生成一份结构化笔记（document artifact），整理对话的核心要点、结论和重要信息',
                    actions:   '生成一个行动清单（document artifact），列出对话中明确的待办任务和下一步行动，用 - [ ] 格式',
                    timeline:  '生成一个时间轴（document artifact），梳理对话涉及的重要里程碑和时间节点',
                  }
                  const parts = selectedVizTypes.map(vid => `- ${VIZ_PROMPTS[vid]}`).join('\n')
                  const prompt = selectedVizTypes.length === 1
                    ? `帮我基于这段对话，${VIZ_PROMPTS[selectedVizTypes[0]]}。`
                    : `帮我基于这段对话生成以下产出物，请按顺序逐一输出，每个都要完整：\n${parts}`
                  setShowVizSuggest(false)
                  setSelectedVizTypes([])
                  handleSend(prompt)
                }}
                onDismiss={() => { setShowVizSuggest(false); setSelectedVizTypes([]) }}
              />
            )}

            <InputBar
              onSend={handleSend}
              onFileUpload={handleFileUpload}
              disabled={streaming}
              tokenPercent={tokenPercent}
              messageCount={messages.length}
              onCommand={handleCommand}
              onNewNote={handleNewNote}
            />
          </div>

          {/* Right panel */}
          {panelOpen && !project?.isTemp && (
            <FilePanel
              project={project}
              files={files}
              messages={messages}
              tokenPercent={tokenPercent}
              onConsolidateKnowledge={handleConsolidateKnowledge}
              onGenerateSummary={handleGenerateSummary}
              onSummaryEdit={async (text) => {
                const updated = { ...project, status: text, updatedAt: Date.now() }
                await saveProject(updated)
                setProject(updated)
              }}
              onClose={() => setPanelOpen(false)}
              memory={memory}
              reflectionRunning={reflectionRunning}
              onMemoryEdit={handleMemoryEdit}
              onReflect={handleManualReflect}
              onKnowledgeEdit={async (arr) => {
                const updated = { ...project, knowledge: arr, updatedAt: Date.now() }
                await saveProject(updated)
                setProject(updated)
              }}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateProjectModal
          suggestedName={suggestedMeta.name}
          suggestedSummary={suggestedMeta.status || suggestedMeta.summary}
          loading={createLoading}
          onConfirm={handleConfirmCreate}
          onCancel={() => setShowCreateModal(false)}
        />
      )}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showSearch && (
        <SearchModal
          onClose={() => setShowSearch(false)}
          onNavigate={(projectId) => { setShowSearch(false); navigate(`/project/${projectId}`) }}
        />
      )}
    </div>
  )
}

const VIZ_OPTIONS = [
  { id: 'mindmap',   icon: '🗺️', label: '脑图' },
  { id: 'flowchart', icon: '🔀', label: '流程图' },
  { id: 'notes',     icon: '📄', label: '结构化笔记' },
  { id: 'actions',   icon: '✅', label: '行动清单' },
  { id: 'timeline',  icon: '⏱️', label: '时间轴' },
]

function VizSuggestBanner({ selectedTypes, onToggle, onGenerate, onDismiss }) {
  return (
    <div style={{
      padding: '10px 24px',
      background: 'var(--bg-card)',
      borderTop: '1px solid var(--border)',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 14 }}>✨</span>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
          对话已有一定深度，选择要生成的产出物：
        </span>
        <button
          onClick={onDismiss}
          style={{ marginLeft: 'auto', fontSize: 11, padding: '2px 8px', borderRadius: 5, cursor: 'pointer', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
        >稍后</button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {VIZ_OPTIONS.map(opt => {
          const active = selectedTypes.includes(opt.id)
          return (
            <button
              key={opt.id}
              onClick={() => onToggle(opt.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '5px 11px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                background: active ? 'var(--accent-glow)' : 'var(--bg-hover)',
                color: active ? 'var(--accent)' : 'var(--text-secondary)',
                fontWeight: active ? 600 : 400,
                transition: 'all 0.15s',
              }}
            >
              <span>{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          )
        })}
        <button
          onClick={onGenerate}
          disabled={selectedTypes.length === 0}
          style={{
            marginLeft: 'auto', fontSize: 12, padding: '5px 14px', borderRadius: 20,
            cursor: selectedTypes.length > 0 ? 'pointer' : 'default',
            background: selectedTypes.length > 0 ? 'var(--accent)' : 'var(--bg-hover)',
            color: selectedTypes.length > 0 ? 'white' : 'var(--text-muted)',
            border: 'none', fontWeight: 600, transition: 'all 0.15s',
          }}
        >
          {selectedTypes.length > 0 ? `生成 ${selectedTypes.length} 项` : '请选择'}
        </button>
      </div>
    </div>
  )
}


const EMOJI_LIST = [
  '📁','💼','🚀','🎯','💡','🔬','🧠','⚡','🌟','🔥',
  '📊','📈','🗂','📝','🔧','🎨','💻','🌐','🔑','🏆',
  '🎓','📚','🧩','⚙️','🔍','💬','🎪','🌱','🎵','🤖',
  '🦋','🌈','🏔','🌊','🎭','💎','🌿','🔮','🧬','🎲',
]

function SkillPickerPopover({ skills, activeSkillId, onSelect, onClear, onClose }) {
  const { t } = useTranslation()
  const ref = useRef(null)
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    setTimeout(() => document.addEventListener('mousedown', handleClick), 0)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  return (
    <div ref={ref} style={{
      position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 300,
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '6px', boxShadow: 'var(--shadow-lg)',
      minWidth: 200, maxWidth: 280,
    }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', padding: '4px 8px 6px', letterSpacing: '0.05em' }}>
        {t('chat.defaultSkill')}
      </div>
      {skills.map(skill => {
        const isActive = skill.id === activeSkillId
        return (
          <button key={skill.id} onClick={() => onSelect(skill.id)} style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            padding: '6px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', textAlign: 'left',
            background: isActive ? 'var(--accent-glow)' : 'none',
            color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
            fontSize: 12, fontWeight: isActive ? 600 : 400,
            transition: 'background 0.1s',
          }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)' }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'none' }}
          >
            <span style={{ fontSize: 14, flexShrink: 0 }}>{skill.icon}</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{skill.name}</span>
            {isActive && <span style={{ fontSize: 10, color: 'var(--accent)' }}>✓</span>}
          </button>
        )
      })}
      {activeSkillId && (
        <>
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 8px' }} />
          <button onClick={onClear} style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            padding: '5px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
            background: 'none', color: 'var(--text-muted)', fontSize: 11, textAlign: 'left',
            transition: 'background 0.1s',
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <span>✕</span>
            <span>{t('chat.unbindSkill')}</span>
          </button>
        </>
      )}
    </div>
  )
}

function SidebarThread({ label, preview, isActive, onClick, onDelete }) {
  const [hovered, setHovered] = useState(false)
  const [confirming, setConfirming] = useState(false)

  function handleDeleteClick(e) {
    e.stopPropagation()
    setConfirming(true)
  }
  function handleConfirm(e) {
    e.stopPropagation()
    setConfirming(false)
    onDelete()
  }
  function handleCancel(e) {
    e.stopPropagation()
    setConfirming(false)
  }

  return (
    <div
      onClick={!confirming ? onClick : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setConfirming(false) }}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 6,
        padding: '5px 8px', borderRadius: 5, cursor: confirming ? 'default' : 'pointer',
        background: confirming ? 'rgba(239,68,68,0.06)' : isActive ? 'var(--bg-hover)' : hovered ? 'var(--bg-hover)' : 'none',
        border: confirming ? '1px solid rgba(239,68,68,0.2)' : '1px solid transparent',
        marginBottom: 1, position: 'relative',
      }}
    >
      {confirming ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 10, color: 'var(--red, #ef4444)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>确认删除？</span>
          <button onClick={handleConfirm} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.1)', color: 'var(--red, #ef4444)', cursor: 'pointer', flexShrink: 0 }}>删除</button>
          <button onClick={handleCancel} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}>取消</button>
        </div>
      ) : (
        <>
          <span style={{
            width: 5, height: 5, borderRadius: '50%', flexShrink: 0, marginTop: 4,
            background: isActive ? 'var(--accent)' : 'var(--border)',
            display: 'inline-block', transition: 'background 0.15s',
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 11, color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: isActive ? 600 : 400,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4,
              paddingRight: onDelete && hovered ? 16 : 0,
            }}>
              {label}
            </div>
            {preview && (
              <div style={{
                fontSize: 10, color: 'var(--text-muted)', marginTop: 1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {preview}
              </div>
            )}
          </div>
          {onDelete && hovered && (
            <button
              onClick={handleDeleteClick}
              style={{
                position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                width: 16, height: 16, borderRadius: 4, border: 'none',
                background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, padding: 0, lineHeight: 1,
              }}
              onMouseEnter={e => { e.stopPropagation(); e.currentTarget.style.color = 'var(--red, #ef4444)'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}
            >✕</button>
          )}
        </>
      )}
    </div>
  )
}

function EmojiPicker({ onSelect, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    setTimeout(() => document.addEventListener('mousedown', handleClick), 0)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])
  return (
    <div ref={ref} style={{
      position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 300,
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 12, padding: 10, boxShadow: 'var(--shadow-lg)',
      display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4, width: 236,
    }}>
      {EMOJI_LIST.map(e => (
        <button key={e} onClick={() => onSelect(e)} style={{
          background: 'none', border: 'none', cursor: 'pointer', fontSize: 18,
          padding: '4px', borderRadius: 6, lineHeight: 1, transition: 'background 0.1s',
        }}
          onMouseEnter={ev => ev.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={ev => ev.currentTarget.style.background = 'none'}
        >{e}</button>
      ))}
    </div>
  )
}
