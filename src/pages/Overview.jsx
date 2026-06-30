import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getActiveProjects, getArchivedProjects, getAllConversations,
  saveProject, saveConversation, archiveProject, deleteProject, deleteConversation,
  getWeeklyAICount, getTodayActivity, getPrevWeekAICount, getNewProjectsCount, toggleProjectPin,
} from '../store/db'
import { getInstalledSkills } from '../lib/skills'
import { DEFAULT_MODEL } from '../lib/llm'
import SettingsModal, { getUserProfile } from '../components/SettingsModal'
import DecomposeModal from '../components/DecomposeModal'
import SearchModal from '../components/SearchModal'
import AppRail from '../components/AppRail'

const isElectron = !!window.electronAPI

const TEMPLATES = [
  { id: 'competitive-analysis', icon: '🔍', name: '竞品分析', desc: '系统拆解竞品功能、定位与差异化机会', skillTag: '竞品分析师', systemPrompt: '你是一位竞品分析师。请系统分析竞品的功能定位、产品策略和优劣势，帮我找到差异化机会。先了解我要分析的对象和目标市场。' },
  { id: 'decision-framework', icon: '⚖️', name: '辅助决策', desc: '用框架评估选项，识别隐藏假设和风险', skillTag: '决策框架师', systemPrompt: '你是一位决策框架师。使用 RICE/ICE 或决策矩阵帮我评估选项，识别隐藏假设和风险，给出综合建议。先了解我面临的决策情况。' },
  { id: 'user-research', icon: '👥', name: '用户调研', desc: '设计访谈提纲，分析反馈，提炼核心痛点', skillTag: '用户调研向导', systemPrompt: '你是一位用户研究专家。帮我设计访谈提纲，分析用户反馈，提炼核心痛点和需求。先告诉我你的目标用户群体和研究目标。' },
  { id: 'pm-assistant', icon: '💬', name: '产品功能讨论', desc: '需求拆解、边界定义、方案评审', skillTag: '产品经理助手', systemPrompt: '你是一位产品经理助手。帮我梳理需求、拆解功能、评估优先级，输出清晰可执行的 PRD 要点。先告诉我你想讨论的功能或产品方向。' },
  { id: 'project-retro', icon: '🔄', name: '项目复盘', desc: '引导 Retrospective，提炼经验，制定行动', skillTag: '项目复盘', systemPrompt: '你是一位复盘引导师。带领我做 Retrospective，提炼经验教训，制定具体改进行动。先告诉我要复盘的项目或阶段。' },
  { id: 'knowledge-extractor', icon: '🧠', name: '知识提炼', desc: '从对话历史中主动沉淀方法论和结论', skillTag: 'ContextOS 专属', systemPrompt: '你是一位知识提炼师。帮我从当前对话历史中主动提炼可沉淀的方法论、结论和行动建议，整理成结构化的知识条目。' },
]

function getGreeting(name) {
  const hour = new Date().getHours()
  const n = name ? `，${name}` : ''
  if (hour < 6)  return { text: `夜深了${n} 🌙`, sub: '适合专注，也别忘了休息' }
  if (hour < 10) return { text: `早上好${n} ☀️`, sub: '新的一天，从清晰的目标开始' }
  if (hour < 14) return { text: `上午好${n} ✨`, sub: '思路正清晰，适合深度工作' }
  if (hour < 18) return { text: `下午好${n} ☀️`, sub: '保持节奏，继续推进今天的进展' }
  return { text: `晚上好${n} 🌆`, sub: '回顾今天的收获，为明天做好准备' }
}

export default function Overview() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [archivedProjects, setArchivedProjects] = useState([])
  const [conversations, setConversations] = useState([])
  const [showSettings, setShowSettings] = useState(false)
  const [weeklyCount, setWeeklyCount] = useState(0)
  const [prevWeekCount, setPrevWeekCount] = useState(0)
  const [newProjectsCount, setNewProjectsCount] = useState(0)
  const [profile, setProfile] = useState({ name: '', role: '' })
  const [showAllProjects, setShowAllProjects] = useState(false)
  const [animateStats, setAnimateStats] = useState(false)
  const [showDecompose, setShowDecompose] = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  useEffect(() => {
    loadData()
    const timer = setTimeout(() => setAnimateStats(true), 80)
    const handleKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setShowSearch(true) }
      if (e.key === 'Escape') setShowSearch(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => { clearTimeout(timer); window.removeEventListener('keydown', handleKey) }
  }, [])

  async function loadData() {
    const [projs, archived, convs, weekly, prevWeek, newProjs] = await Promise.all([
      getActiveProjects(), getArchivedProjects(), getAllConversations(), getWeeklyAICount(),
      getPrevWeekAICount(), getNewProjectsCount(30),
    ])
    setProjects(projs)
    setArchivedProjects(archived)
    setConversations(convs)
    setWeeklyCount(weekly)
    setPrevWeekCount(prevWeek)
    setNewProjectsCount(newProjs)
    setProfile(getUserProfile())
  }

  async function handleTogglePin(projectId, e) {
    e.stopPropagation()
    await toggleProjectPin(projectId)
    loadData()
  }

  function handleSettingsClose() { setShowSettings(false); setProfile(getUserProfile()) }

  function handleStartChat() { navigate(`/project/${crypto.randomUUID()}`) }

  async function handleDailyGuide() {
    const id = crypto.randomUUID()
    const now = Date.now()
    const activity = await getTodayActivity()
    const today = new Date()
    const dateStr = today.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })
    const timeStr = `${today.getHours()}:${String(today.getMinutes()).padStart(2, '0')}`
    let activityBlock = ''
    if (activity.projects.length > 0) {
      activityBlock += '\n【项目工作】\n'
      activityBlock += activity.projects.map(p => `- 「${p.name}」今日 ${p.count} 条消息${p.excerpt ? '，最近讨论：' + p.excerpt : ''}`).join('\n')
    }
    if (activity.conversations.length > 0) {
      activityBlock += '\n\n【轻量对话】\n'
      activityBlock += activity.conversations.map(c => `- 「${c.name}」今日 ${c.count} 条消息${c.excerpt ? '，AI 回复：' + c.excerpt : ''}`).join('\n')
    }
    const hasActivity = activity.hasActivity
    const activityCtx = hasActivity ? `\n\n用户今天在 ContextOS 中的活动记录如下：${activityBlock}` : '\n\n用户今天在 ContextOS 暂无对话记录。'
    const systemPrompt = `你是用户的 AI 工作伙伴，现在是 ${dateStr} ${timeStr}，是做今日复盘的好时机。${activityCtx}\n\n请按以下节奏展开对话：\n1. 用 1-2 句自然的话打招呼，${hasActivity ? '简短点出今天看到的工作内容（基于上面的记录）' : '问用户今天都在忙些什么'}\n2. 主动问用户：今天完成了什么？有没有卡住或者没做完的事？\n3. 等用户回复后，帮他整理出明日待办清单，要求：\n   - 每项具体可执行，不泛泛而谈\n   - 标注优先级：🔴 必做 / 🟡 重要 / ⚪ 可以推迟\n   - 结合今天未完成的事和明天需要跟进的内容\n\n语气像一个了解你工作状态的同事，亲切自然，不要太正式。`
    await saveConversation({ id, title: `${dateStr} 复盘`, systemPrompt, preview: '今日复盘 · 整理明日待办', rounds: 0, createdAt: now, updatedAt: now })
    navigate(`/project/${id}?convId=${id}`)
  }

  async function handleNewProject() {
    const id = crypto.randomUUID()
    const now = Date.now()
    await saveProject({ id, name: '新项目', status: '', knowledge: [], model: DEFAULT_MODEL, icon: '📁', createdAt: now, updatedAt: now })
    navigate(`/project/${id}`)
  }

  async function handleStartTemplate(template) {
    const id = crypto.randomUUID()
    const now = Date.now()
    await saveConversation({ id, title: template.name, systemPrompt: template.systemPrompt, preview: '', rounds: 0, createdAt: now, updatedAt: now })
    navigate(`/project/${id}?template=${template.id}&convId=${id}`)
  }

  async function handleArchiveProject(projId, e) {
    e.stopPropagation()
    const target = projects.find(p => p.id === projId)
    await archiveProject(projId)
    setProjects(prev => prev.filter(p => p.id !== projId))
    if (target) setArchivedProjects(prev => [{ ...target, archived: true }, ...prev])
  }

  async function handleDeleteProject(id) {
    if (!confirm('确定删除这个项目吗？')) return
    await deleteProject(id)
    setProjects(prev => prev.filter(p => p.id !== id))
    setArchivedProjects(prev => prev.filter(p => p.id !== id))
  }

  async function handleDeleteConv(id) {
    if (!confirm('确定删除这条对话吗？')) return
    await deleteConversation(id)
    setConversations(prev => prev.filter(c => c.id !== id))
  }

  async function handlePromoteConv(conv) {
    const id = crypto.randomUUID()
    const now = Date.now()
    await saveProject({ id, name: conv.title || '新项目', status: '', knowledge: [], activeSkillId: conv.activeSkillId || null, model: DEFAULT_MODEL, icon: '📁', createdAt: now, updatedAt: now })
    navigate(`/project/${id}`)
  }

  const displayName = profile.name || ''
  const { text: greetText, sub: greetSub } = getGreeting(displayName)
  const sortedProjects = [...projects].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updatedAt - a.updatedAt)
  const visibleProjects = showAllProjects ? sortedProjects : sortedProjects.slice(0, 6)
  const knowledgeCount = projects.reduce((sum, p) => sum + (Array.isArray(p.knowledge) ? p.knowledge.length : 0), 0)
  const focusProject = sortedProjects[0]
  const weeklyDelta = weeklyCount - prevWeekCount

  const stats = [
    { label: '活跃项目', value: projects.length, color: 'var(--accent-raw)', delta: newProjectsCount > 0 ? `↑ ${newProjectsCount} 本月新增` : null },
    { label: '知识条目', value: knowledgeCount, color: 'var(--cyan)', delta: null },
    { label: '本周对话', value: weeklyCount, color: 'var(--green)', delta: weeklyDelta > 0 ? `↑ ${weeklyDelta} 较上周` : weeklyDelta < 0 ? `↓ ${Math.abs(weeklyDelta)} 较上周` : null },
    { label: '未归项', value: conversations.length, color: 'var(--amber)', delta: null },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--bg-base)', position: 'relative', zIndex: 1 }}>

      {/* 标题栏 */}
      <div style={{
        height: 50, background: 'var(--bg-titlebar)', backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', padding: '0 16px',
        flexShrink: 0, position: 'relative', WebkitAppRegion: 'drag',
      }}>
        <div style={{ width: isElectron ? 72 : 4, flexShrink: 0, WebkitAppRegion: 'no-drag' }} />
        <div style={{
          position: 'absolute', left: '50%', transform: 'translateX(-50%)',
          fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 700,
          color: 'var(--text-primary)', letterSpacing: '-0.01em', WebkitAppRegion: 'no-drag',
        }}>
          ContextOS
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, WebkitAppRegion: 'no-drag' }}>
          <button onClick={() => setShowSearch(true)} style={{ width: 34, height: 34, borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
            title="搜索 ⌘K"
          >⌕</button>
          <button onClick={handleNewProject} style={{ width: 34, height: 34, borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
            title="新建项目"
          >⊞</button>
        </div>
      </div>

      {/* 主体 */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Rail */}
        <AppRail activePage="overview" navigate={navigate} onAvatarClick={() => setShowSettings(true)} displayName={displayName} />

        {/* 主内容 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* 问候区 */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 5 }}>
                {greetText}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {projects.length > 0 ? (
                  <>你有 <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{projects.length} 个活跃项目</strong>，积累了 <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{knowledgeCount} 条知识</strong>。{greetSub}</>
                ) : greetSub}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', maxWidth: 260, cursor: 'pointer' }}
              onClick={handleDailyGuide}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-card)' }}
            >
              <div style={{ fontSize: 16, flexShrink: 0 }}>🎯</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--text-primary)', fontWeight: 600, fontFamily: 'var(--font-ui)' }}>今日重点</strong><br />
                {focusProject ? focusProject.name + ' · 继续推进' : '点击开始今日复盘'}
              </div>
            </div>
          </div>

          {/* 统计栏 */}
          <div style={{ display: 'flex', gap: 12 }}>
            {stats.map((s, i) => (
              <StatCard key={s.label} {...s} animate={animateStats} delay={i * 0.06} />
            ))}
          </div>

          {/* 项目区 */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 7 }}>
                项目空间
                {projects.length > 0 && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '1px 6px', borderRadius: 4, fontWeight: 400 }}>
                    {projects.length}个
                  </span>
                )}
              </div>
              <button onClick={() => navigate('/skills')} style={{ fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 600, color: 'var(--accent-raw)', cursor: 'pointer', background: 'none', border: 'none', opacity: 0.8, transition: 'opacity 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0.8'}
              >技能库 →</button>
            </div>

            {projects.length === 0 ? (
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '32px 28px', animation: 'slide-up 0.4s ease-out' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', marginBottom: 6 }}>开始你的第一个项目</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.8 }}>
                  创建项目，每次对话自动积累上下文<br />
                  AI 每次进入都知道你做了什么、决定了什么
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={handleDailyGuide} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.22)', color: 'var(--amber)' }}>
                    ⚡ 今日复盘
                  </button>
                  <button onClick={handleNewProject} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', background: 'var(--bg-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                    + 新建项目
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {visibleProjects.map((p, i) => (
                    <ProjectCard key={p.id} project={p} index={i} navigate={navigate} onArchive={handleArchiveProject} onDelete={handleDeleteProject} onPin={(e) => handleTogglePin(p.id, e)} />
                  ))}
                  {/* 新建项目卡片 */}
                  {visibleProjects.length < 6 && (
                    <div onClick={handleNewProject} style={{
                      background: 'transparent', border: '1px dashed var(--border)',
                      borderRadius: 12, cursor: 'pointer', transition: 'all 0.15s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexDirection: 'column', gap: 8, minHeight: 160,
                    }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-border)'; e.currentTarget.style.background = 'var(--accent-glow)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'transparent' }}
                    >
                      <div style={{ fontSize: 20, color: 'var(--text-muted)' }}>+</div>
                      <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>新建项目</div>
                    </div>
                  )}
                </div>
                {projects.length > 6 && (
                  <button onClick={() => setShowAllProjects(v => !v)} style={{ marginTop: 12, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '9px 0', borderRadius: 8, fontSize: 11, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontWeight: 500, transition: 'all 0.15s' }}>
                    {showAllProjects ? '↑ 收起' : `↓ 展开全部 ${projects.length} 个项目`}
                  </button>
                )}
              </>
            )}
          </div>

          {/* 快速开始 */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>快速开始</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {TEMPLATES.map((tmpl, i) => (
                <div key={tmpl.id} onClick={() => handleStartTemplate(tmpl)} style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '13px 14px',
                  cursor: 'pointer', transition: 'all 0.15s',
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  animation: `slide-up 0.3s ease-out ${i * 0.03}s both`,
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-card)' }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--bg-hover)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
                    {tmpl.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{tmpl.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4 }}>{tmpl.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 最近对话 */}
          {conversations.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>最近对话</div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '1px 6px', borderRadius: 4, fontWeight: 400 }}>未归项</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>共 {conversations.length} 条</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {conversations.slice(0, 8).map(conv => (
                  <ConvRow key={conv.id} conv={conv}
                    onNavigate={() => navigate(`/project/${conv.id}?convId=${conv.id}`)}
                    onPromote={() => handlePromoteConv(conv)}
                    onDelete={() => handleDeleteConv(conv.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 归档项目 */}
          {archivedProjects.length > 0 && (
            <div style={{ paddingTop: 8, borderTop: '1px dashed var(--border)', opacity: 0.6 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>已归档 · {archivedProjects.length}个</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {archivedProjects.map(p => (
                  <div key={p.id} onClick={() => navigate(`/project/${p.id}`)} style={{ padding: '10px 12px', borderRadius: 8, cursor: 'pointer', background: 'var(--bg-card)', border: '1px dashed var(--border)', transition: 'opacity 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{p.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{new Date(p.updatedAt).toLocaleDateString('zh-CN')}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ height: 24 }} />
        </div>
      </div>

      {showSettings && <SettingsModal onClose={handleSettingsClose} />}
      {showDecompose && <DecomposeModal onClose={() => setShowDecompose(false)} onCreated={loadData} />}
      {showSearch && (
        <SearchModal
          onClose={() => setShowSearch(false)}
          onNavigate={(projectId) => { setShowSearch(false); navigate(`/project/${projectId}`) }}
        />
      )}
    </div>
  )
}


function ProjectCard({ project: p, index, navigate, onArchive, onDelete, onPin }) {
  const [hovered, setHovered] = useState(false)
  const knowledgeLen = Array.isArray(p.knowledge) ? p.knowledge.length : 0
  const depthPct = Math.min(100, Math.round((knowledgeLen / 20) * 100))
  const isActive = !p.archived

  const statusMap = {
    active: { label: '进行中', bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.2)', color: 'var(--green)' },
    paused: { label: '暂停中', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)', color: 'var(--amber)' },
    archived: { label: '已归档', bg: 'rgba(126,134,158,0.08)', border: 'rgba(126,134,158,0.2)', color: 'var(--text-muted)' },
  }
  const recentlyActive = p.updatedAt && (Date.now() - p.updatedAt < 7 * 24 * 60 * 60 * 1000)
  const st = statusMap[p.archived ? 'archived' : recentlyActive ? 'active' : 'paused']

  return (
    <div
      onClick={() => navigate(`/project/${p.id}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--bg-card)', border: `1px solid ${p.pinned ? 'var(--accent-border)' : 'var(--border)'}`,
        borderRadius: 12, padding: 16, cursor: 'pointer', transition: 'all 0.15s',
        display: 'flex', flexDirection: 'column', gap: 10,
        position: 'relative', overflow: 'hidden',
        animation: `slide-up 0.3s ease-out ${index * 0.04}s both`,
        ...(hovered ? { borderColor: 'var(--border-strong)', background: 'var(--bg-hover)', transform: 'translateY(-1px)', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' } : {}),
      }}
    >
      {/* 活跃项目顶部辉光线 */}
      {isActive && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, var(--accent-raw), transparent)' }} />
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>
          {p.icon || '📁'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={onPin}
            title={p.pinned ? '取消置顶' : '置顶项目'}
            style={{
              width: 22, height: 22, border: 'none', borderRadius: 5, cursor: 'pointer',
              background: p.pinned ? 'var(--accent-dim)' : 'transparent',
              color: p.pinned ? 'var(--accent-raw)' : 'var(--text-muted)',
              fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: hovered || p.pinned ? 1 : 0,
              transition: 'all 0.15s',
            }}
          >
            📌
          </button>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 4, background: st.bg, border: `1px solid ${st.border}`, color: st.color }}>
            {st.label}
          </span>
        </div>
      </div>
      <div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: 4 }}>{p.name}</div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {p.status || '暂无项目状态'}
        </div>
      </div>
      {/* 知识深度条 */}
      {knowledgeLen > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>上下文深度</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, color: 'var(--cyan)' }}>{depthPct}%</span>
          </div>
          <div style={{ height: 3, background: 'var(--bg-hover)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${depthPct}%`, borderRadius: 2, background: 'linear-gradient(90deg, var(--accent-raw), var(--cyan))', boxShadow: '0 0 6px rgba(34,211,238,0.2)' }} />
          </div>
        </div>
      )}
      {/* 元数据 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
        {knowledgeLen > 0 && <span>🧠 {knowledgeLen}条知识</span>}
        <span style={{ marginLeft: 'auto' }}>{new Date(p.updatedAt).toLocaleDateString('zh-CN')}</span>
      </div>
    </div>
  )
}

function ConvRow({ conv, onNavigate, onPromote, onDelete }) {
  const [hovered, setHovered] = useState(false)
  const colors = ['var(--amber)', 'var(--text-muted)', 'var(--accent-raw)', 'var(--green)']
  const dotColor = colors[Math.abs(conv.id?.charCodeAt(0) || 0) % colors.length]

  return (
    <div
      onClick={onNavigate}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, cursor: 'pointer', transition: 'background 0.1s', background: hovered ? 'var(--bg-card)' : 'transparent' }}
    >
      <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: dotColor }} />
      <div style={{ flex: 1, fontSize: 12, color: hovered ? 'var(--text-primary)' : 'var(--text-secondary)', fontFamily: 'var(--font-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {conv.title || '无标题对话'}
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>
        {formatRelTime(conv.updatedAt)}
      </span>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, color: 'var(--accent-raw)', opacity: hovered ? 1 : 0, transition: 'opacity 0.15s', padding: '2px 6px', borderRadius: 3, border: '1px solid var(--accent-border)', background: 'var(--accent-dim)', cursor: 'pointer', flexShrink: 0 }}
        onClick={e => { e.stopPropagation(); onPromote() }}
      >
        升为项目 ↑
      </div>
    </div>
  )
}

function StatCard({ label, value, color, delta, animate, delay }) {
  const [displayed, setDisplayed] = useState(0)
  const prevRef = useRef(0)

  useEffect(() => {
    const target = Number(value) || 0
    if (!animate || target === prevRef.current) { setDisplayed(target); return }
    const start = prevRef.current
    let step = 0
    const steps = 24
    const id = setInterval(() => {
      step++
      setDisplayed(Math.round(start + (target - start) * (step / steps)))
      if (step >= steps) { clearInterval(id); prevRef.current = target }
    }, 18)
    return () => clearInterval(id)
  }, [value, animate])

  const labelMap = {
    '活跃项目': '活跃项目',
    '知识条目': '知识条目',
    '本周对话': '本周对话',
    '未归项': '未归项对话',
  }

  return (
    <div style={{
      flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 4,
      animation: animate ? `slide-up 0.4s ease-out ${delay}s both` : 'none',
      transition: 'border-color 0.15s',
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-strong)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 600, color, letterSpacing: '-0.02em', lineHeight: 1 }}>{displayed}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</div>
      {delta && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: delta.startsWith('↑') ? 'var(--green)' : 'var(--amber)', marginTop: 2 }}>{delta}</div>
      )}
    </div>
  )
}

function formatRelTime(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m}分钟前`
  if (h < 24) return `今天 ${new Date(ts).getHours()}:${String(new Date(ts).getMinutes()).padStart(2, '0')}`
  if (d < 2) return '昨天'
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}
