import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard, FolderOpen, MessageSquare, Sparkles, Settings,
  MessageCirclePlus, FolderPlus, Archive, ChevronDown, ChevronUp, Zap, Scissors, Plug, Search,
} from 'lucide-react'
import {
  getActiveProjects, getArchivedProjects, getAllConversations,
  saveProject, saveConversation, archiveProject, deleteProject, deleteConversation,
  getWeeklyAICount, getTodayActivity,
} from '../store/db'
import { getInstalledSkills } from '../lib/skills'
import { DEFAULT_MODEL } from '../lib/llm'
import ProjectCard from '../components/ProjectCard'
import SettingsModal, { getUserProfile } from '../components/SettingsModal'
import DecomposeModal from '../components/DecomposeModal'
import SearchModal from '../components/SearchModal'

const PROJECT_PREVIEW_LIMIT = 6

const TEMPLATES = [
  { id: 'competitive-analysis', icon: '🧭', name: '竞品分析', desc: '系统分析竞品定位、功能差异，找到差异化机会', skillTag: '竞品分析师', systemPrompt: '你是一位竞品分析师。请系统分析竞品的功能定位、产品策略和优劣势，帮我找到差异化机会。先了解我要分析的对象和目标市场。' },
  { id: 'decision-framework', icon: '⚖️', name: '帮我决策', desc: 'RICE/ICE 框架评估选项，识别隐藏假设和风险', skillTag: '决策框架师', systemPrompt: '你是一位决策框架师。使用 RICE/ICE 或决策矩阵帮我评估选项，识别隐藏假设和风险，给出综合建议。先了解我面临的决策情况。' },
  { id: 'user-research', icon: '🔭', name: '用户调研向导', desc: '设计访谈提纲，分析反馈，提炼核心痛点', skillTag: '用户调研向导', systemPrompt: '你是一位用户研究专家。帮我设计访谈提纲，分析用户反馈，提炼核心痛点和需求。先告诉我你的目标用户群体和研究目标。' },
  { id: 'pm-assistant', icon: '📦', name: '产品功能讨论', desc: '梳理需求、拆解功能、评估优先级，输出 PRD 要点', skillTag: '产品经理助手', systemPrompt: '你是一位产品经理助手。帮我梳理需求、拆解功能、评估优先级，输出清晰可执行的 PRD 要点。先告诉我你想讨论的功能或产品方向。' },
  { id: 'project-retro', icon: '🔄', name: '项目复盘', desc: '引导 Retrospective，提炼教训，制定改进行动', skillTag: '项目复盘', systemPrompt: '你是一位复盘引导师。带领我做 Retrospective，提炼经验教训，制定具体改进行动。先告诉我要复盘的项目或阶段。' },
  { id: 'knowledge-extractor', icon: '🧲', name: '知识提炼', desc: '从对话历史主动提炼可沉淀的方法论和结论', skillTag: 'ContextOS 专属', systemPrompt: '你是一位知识提炼师。帮我从当前对话历史中主动提炼可沉淀的方法论、结论和行动建议，整理成结构化的知识条目。' },
]

function getDayGuide(profile, t) {
  const name = profile.name || ''
  const hour = new Date().getHours()
  const sep = name ? t('overview.nameSep') : ''
  const g = (key) => ({
    greeting: `${t('overview.' + key + 'Greet')}${sep}${name}`,
    hint: t('overview.' + key + 'Hint'),
  })
  if (hour < 6)  return g('lateNight')
  if (hour < 10) return g('morning')
  if (hour < 14) return g('forenoon')
  if (hour < 18) return g('afternoon')
  return g('evening')
}

export default function Overview() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [projects, setProjects] = useState([])
  const [archivedProjects, setArchivedProjects] = useState([])
  const [conversations, setConversations] = useState([])
  const [showSettings, setShowSettings] = useState(false)
  const [installedSkills, setInstalledSkills] = useState([])
  const [weeklyCount, setWeeklyCount] = useState(0)
  const [profile, setProfile] = useState({ name: '', role: '' })
  const [showAllProjects, setShowAllProjects] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [animateStats, setAnimateStats] = useState(false)
  const [showDecompose, setShowDecompose] = useState(false)
  const [showConvList, setShowConvList] = useState(true)
  const [showSearch, setShowSearch] = useState(false)

  useEffect(() => {
    loadData()
    const t = setTimeout(() => setAnimateStats(true), 80)
    const handleKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setShowSearch(true) }
      if (e.key === 'Escape') setShowSearch(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => { clearTimeout(t); window.removeEventListener('keydown', handleKey) }
  }, [])

  async function loadData() {
    const [projs, archived, convs, weekly] = await Promise.all([
      getActiveProjects(), getArchivedProjects(), getAllConversations(),
      getWeeklyAICount(),
    ])
    setProjects(projs)
    setArchivedProjects(archived)
    setConversations(convs)
    setWeeklyCount(weekly)
    setProfile(getUserProfile())
    setInstalledSkills(await getInstalledSkills())
  }

  function handleSettingsClose() { setShowSettings(false); setProfile(getUserProfile()) }

  function handleStartChat() { navigate(`/project/${crypto.randomUUID()}`) }

  async function handleDailyGuide() {
    const id = crypto.randomUUID()
    const now = Date.now()

    // 读取今天真实的对话记录，作为复盘上下文
    const activity = await getTodayActivity()

    const today = new Date()
    const dateStr = today.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })
    const timeStr = `${today.getHours()}:${String(today.getMinutes()).padStart(2, '0')}`

    // 拼接今日活动摘要
    let activityBlock = ''
    if (activity.projects.length > 0) {
      activityBlock += '\n【项目工作】\n'
      activityBlock += activity.projects.map(p =>
        `- 「${p.name}」今日 ${p.count} 条消息${p.excerpt ? '，最近讨论：' + p.excerpt : ''}`
      ).join('\n')
    }
    if (activity.conversations.length > 0) {
      activityBlock += '\n\n【轻量对话】\n'
      activityBlock += activity.conversations.map(c =>
        `- 「${c.name}」今日 ${c.count} 条消息${c.excerpt ? '，AI 回复：' + c.excerpt : ''}`
      ).join('\n')
    }

    const hasActivity = activity.hasActivity
    const activityCtx = hasActivity
      ? `\n\n用户今天在 ContextOS 中的活动记录如下：${activityBlock}`
      : '\n\n用户今天在 ContextOS 暂无对话记录。'

    const systemPrompt = `你是用户的 AI 工作伙伴，现在是 ${dateStr} ${timeStr}，是做今日复盘的好时机。${activityCtx}

请按以下节奏展开对话：
1. 用 1-2 句自然的话打招呼，${hasActivity ? '简短点出今天看到的工作内容（基于上面的记录）' : '问用户今天都在忙些什么'}
2. 主动问用户：今天完成了什么？有没有卡住或者没做完的事？
3. 等用户回复后，帮他整理出明日待办清单，要求：
   - 每项具体可执行，不泛泛而谈
   - 标注优先级：🔴 必做 / 🟡 重要 / ⚪ 可以推迟
   - 结合今天未完成的事和明天需要跟进的内容

语气像一个了解你工作状态的同事，亲切自然，不要太正式。`

    await saveConversation({
      id, title: `${dateStr} 复盘`,
      systemPrompt, preview: '今日复盘 · 整理明日待办',
      rounds: 0, createdAt: now, updatedAt: now,
    })
    navigate(`/project/${id}?convId=${id}`)
  }

  async function handleNewProject() {
    const id = crypto.randomUUID()
    const now = Date.now()
    await saveProject({ id, name: '新项目', status: '', knowledge: '', model: DEFAULT_MODEL, icon: '📁', createdAt: now, updatedAt: now })
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
    if (target) setArchivedProjects(prev => [{ ...target, status: 'archived' }, ...prev])
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
    await saveProject({ id, name: conv.title || '新项目', status: '', knowledge: '', activeSkillId: conv.activeSkillId || null, model: DEFAULT_MODEL, icon: '📁', createdAt: now, updatedAt: now })
    navigate(`/project/${id}`)
  }

  const { greeting, hint } = getDayGuide(profile, t)
  const displayName = profile.name || 'ContextOS'
  const visibleProjects = showAllProjects ? projects : projects.slice(0, PROJECT_PREVIEW_LIMIT)
  const knowledgeCount = projects.reduce((sum, p) => {
    if (!p.knowledge) return sum
    return sum + p.knowledge.split('\n').filter(l => l.trim()).length
  }, 0)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-base)' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, minWidth: 220,
        background: window.electronAPI ? 'transparent' : 'var(--bg-surface)',
        borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '18px 0',
        WebkitAppRegion: 'drag',
      }}>
        <div style={{
          padding: '0 18px 24px', display: 'flex', alignItems: 'center', gap: 9,
          // 红绿灯区域留白（hiddenInset 模式红绿灯约在 y:18，高度约 28px）
          paddingTop: window.electronAPI ? 44 : undefined,
          WebkitAppRegion: 'no-drag',
        }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--accent-border)' }}>
            <span style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>C</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Context<span style={{ color: 'var(--accent)' }}>OS</span>
          </div>
        </div>
        <nav style={{ padding: '0 10px', flex: 1, overflowY: 'auto', WebkitAppRegion: 'no-drag' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', padding: '0 8px', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('nav.workbench')}</div>
          <NavItem icon={<LayoutDashboard size={15} />} label={t('nav.overview')} active />
          <NavItem icon={<FolderOpen size={15} />} label={t('nav.projects')} badge={projects.length || undefined} onClick={() => document.getElementById('section-projects')?.scrollIntoView({ behavior: 'smooth' })} />

          {/* 对话 — 可展开列表 */}
          <NavItem
            icon={<MessageSquare size={15} />}
            label={t('nav.conversations')}
            badge={conversations.length || undefined}
            expandable
            expanded={showConvList}
            onToggle={() => setShowConvList(v => !v)}
          />
          {showConvList && (
            <div style={{ marginLeft: 10, borderLeft: '1px solid var(--border)', paddingLeft: 8, marginBottom: 4 }}>
              {conversations.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '6px 8px' }}>{t('nav.noConversations')}</div>
              ) : (
                conversations.slice(0, 8).map(conv => (
                  <ConvSideItem
                    key={conv.id}
                    conv={conv}
                    onNavigate={() => navigate(`/project/${conv.id}?convId=${conv.id}`)}
                    onPromote={() => handlePromoteConv(conv)}
                    onDelete={() => handleDeleteConv(conv.id)}
                  />
                ))
              )}
              {conversations.length > 8 && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '5px 8px' }}>
                  {t('nav.moreItems', { count: conversations.length - 8 })}
                </div>
              )}
            </div>
          )}

          <NavItem icon={<Sparkles size={15} />} label={t('nav.skills')} onClick={() => navigate('/skills')} />
          <NavItem icon={<Plug size={15} />} label={t('nav.mcp')} onClick={() => navigate('/mcp')} />
        </nav>
        <div style={{ padding: '10px 10px 0', borderTop: '1px solid var(--border)', WebkitAppRegion: 'no-drag' }}>
          <div onClick={() => setShowSettings(true)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, var(--accent), var(--teal))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white', border: '1px solid var(--accent-border)' }}>
              {displayName.charAt(0).toUpperCase() || 'U'}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{profile.role || t('nav.welcome')}</div>
            </div>
            <Settings size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '32px 40px', background: 'var(--bg-base)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
          <div style={{ animation: 'slide-up 0.35s ease-out' }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 5, letterSpacing: '-0.02em' }}>{greeting}</h1>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{hint}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, animation: 'slide-up 0.35s ease-out 0.05s both' }}>
            <button onClick={() => setShowSearch(true)} style={ghostBtnStyle} title="全局搜索 ⌘K" onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}>
              <Search size={14} />
            </button>
            <button onClick={handleDailyGuide} style={glowBtnStyle} onMouseEnter={e => e.currentTarget.style.opacity = '0.88'} onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
              <Zap size={13} />{t('overview.dailyAssistant')}
            </button>
            <button onClick={() => setShowDecompose(true)} style={ghostBtnStyle} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}>
              <Scissors size={14} />{t('overview.decompose')}
            </button>
            <button onClick={handleNewProject} style={ghostBtnStyle} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}>
              <FolderPlus size={14} />{t('overview.newProject')}
            </button>
            <button onClick={handleStartChat} style={primaryBtnStyle}>
              <MessageCirclePlus size={14} />{t('overview.startChat')}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
          {[
            { label: t('overview.statsActive'),    value: projects.length,       unit: t('overview.unitProj'),  sub: t('overview.subInProgress'), color: 'var(--accent)',         delay: 0 },
            { label: t('overview.statsKnowledge'), value: knowledgeCount,        unit: t('overview.unitLine'),  sub: t('overview.subAccumulated'), color: 'var(--teal)',           delay: 0.06 },
            { label: t('overview.statsWeekly'),    value: weeklyCount,           unit: t('overview.unitRound'), sub: t('overview.subResponse'),   color: 'var(--amber)',          delay: 0.12 },
            { label: t('overview.statsConvs'),     value: conversations.length,  unit: t('overview.unitLine'),  sub: t('overview.subLightConv'),  color: 'var(--text-secondary)', delay: 0.18 },
          ].map(s => <StatCard key={s.label} {...s} animate={animateStats} />)}
        </div>

        {/* Active Projects */}
        <Section
          id="section-projects"
          title={`${t('overview.sectionProjects')}${projects.length > 0 ? ` · ${projects.length}` : ''}`}
          action={
            archivedProjects.length > 0 ? (
              <button onClick={() => setShowArchived(v => !v)} style={subtleBtnStyle}>
                <Archive size={11} />{t('overview.archivedCount', { count: archivedProjects.length })}
                {showArchived ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>
            ) : null
          }
        >
          {projects.length === 0 ? (
            <EmptyProjectsGuide onNew={handleNewProject} onChat={handleStartChat} onGuide={handleDailyGuide} t={t} />
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                {visibleProjects.map((p, i) => (
                  <div key={p.id} style={{ animation: `slide-up 0.3s ease-out ${i * 0.04}s both` }}>
                    <ProjectCard project={p} onDelete={handleDeleteProject} onArchive={handleArchiveProject} />
                  </div>
                ))}
              </div>
              {projects.length > PROJECT_PREVIEW_LIMIT && (
                <button onClick={() => setShowAllProjects(v => !v)} style={{ ...subtleBtnStyle, marginTop: 12, width: '100%', justifyContent: 'center', padding: '9px 0' }}>
                  {showAllProjects
                    ? <><ChevronUp size={13} />{t('overview.collapse')}</>
                    : <><ChevronDown size={13} />{t('overview.moreProjects', { count: projects.length - PROJECT_PREVIEW_LIMIT })}</>}
                </button>
              )}
            </>
          )}

          {showArchived && archivedProjects.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px dashed var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('overview.archivedLabel')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {archivedProjects.map(p => (
                  <div key={p.id} onClick={() => navigate(`/project/${p.id}`)} style={{ padding: '12px 14px', borderRadius: 10, cursor: 'pointer', background: 'var(--bg-card)', border: '1px dashed var(--border)', opacity: 0.6, transition: 'opacity 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{p.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{new Date(p.updatedAt).toLocaleDateString('zh-CN')}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>


        {/* Quick start */}
        <Section title={t('overview.sectionQuickStart')} action={<button onClick={() => navigate('/skills')} style={subtleBtnStyle}><Sparkles size={11} />{t('overview.skillMarket')}</button>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[...TEMPLATES, ...installedSkills].map((tmpl, i) => {
              const displayName = t(`templates.${tmpl.id}_name`, { defaultValue: tmpl.name })
              const displayDesc = t(`templates.${tmpl.id}_desc`, { defaultValue: tmpl.desc })
              return (
                <div key={tmpl.id} onClick={() => handleStartTemplate(tmpl)} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s', display: 'flex', flexDirection: 'column', gap: 6, animation: `slide-up 0.3s ease-out ${i * 0.03}s both` }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-card)' }}
                >
                  <div style={{ fontSize: 20, marginBottom: 2 }}>{tmpl.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{displayName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, flex: 1 }}>{displayDesc}</div>
                  {(tmpl.skillTag || tmpl.name) && (
                    <div style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 3, background: 'var(--accent-light)', color: 'var(--accent)', border: '1px solid var(--accent-border)', display: 'inline-block', alignSelf: 'flex-start', letterSpacing: '0.01em' }}>
                      ✦ {tmpl.skillTag || displayName}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Section>
      </main>

      {showSettings && <SettingsModal onClose={handleSettingsClose} />}
      {showDecompose && (
        <DecomposeModal
          onClose={() => setShowDecompose(false)}
          onCreated={loadData}
        />
      )}
      {showSearch && (
        <SearchModal
          onClose={() => setShowSearch(false)}
          onNavigate={(projectId) => { setShowSearch(false); navigate(`/project/${projectId}`) }}
        />
      )}
    </div>
  )
}

function EmptyProjectsGuide({ onNew, onChat, onGuide, t }) {
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border)', padding: '32px 28px', animation: 'slide-up 0.4s ease-out' }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{t('overview.emptyTitle')}</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.8 }}>
        {t('overview.emptyDesc1')}<br />
        {t('overview.emptyDesc2')}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={onGuide} style={glowBtnStyle} onMouseEnter={e => e.currentTarget.style.opacity = '0.88'} onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
          <Zap size={13} />{t('overview.emptyGuide')}
        </button>
        <button onClick={onNew} style={ghostBtnStyle} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}>
          <FolderPlus size={14} />{t('overview.emptyCreate')}
        </button>
        <button onClick={onChat} style={ghostBtnStyle} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}>
          <MessageCirclePlus size={14} />{t('overview.emptyChat')}
        </button>
      </div>
    </div>
  )
}

function NavItem({ icon, label, active, badge, shortcut, onClick, expandable, expanded, onToggle }) {
  const handleClick = expandable ? onToggle : onClick
  const isClickable = !!(handleClick)
  return (
    <div
      onClick={handleClick}
      style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 8px', borderRadius: 7, cursor: isClickable ? 'pointer' : 'default', fontSize: 13, marginBottom: 2, transition: 'background 0.15s, color 0.15s', color: active ? 'var(--accent)' : 'var(--text-secondary)', background: active ? 'var(--accent-glow)' : 'transparent', fontWeight: active ? 600 : 400 }}
      onMouseEnter={e => { if (!active && isClickable) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)' } }}
      onMouseLeave={e => { if (!active && isClickable) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' } }}
    >
      <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {shortcut && (
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>{shortcut}</span>
      )}
      {badge !== undefined && (
        <span style={{ fontSize: 10, fontWeight: 600, minWidth: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9, background: 'var(--accent)', color: 'white', padding: '0 5px' }}>{badge}</span>
      )}
      {expandable && (
        <ChevronDown size={12} style={{ flexShrink: 0, transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none', color: 'var(--text-muted)' }} />
      )}
    </div>
  )
}

function ConvSideItem({ conv, onNavigate, onPromote, onDelete }) {
  const { t } = useTranslation()
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onNavigate}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 6, cursor: 'pointer', background: hovered ? 'var(--bg-hover)' : 'transparent', transition: 'background 0.15s' }}
    >
      <span style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4 }}>
        {conv.title || t('chat.noTitle')}
      </span>
      {hovered && (
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <button
            onClick={e => { e.stopPropagation(); onPromote() }}
            title={t('project.upgradeToProject')}
            style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', borderRadius: 4, padding: 0 }}
          >
            <FolderPlus size={11} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete() }}
            title="删除"
            style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', borderRadius: 4, padding: 0, fontSize: 11 }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, unit, sub, color, delay, animate }) {
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

  return (
    <div className="stat-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', animation: animate ? `slide-up 0.4s ease-out ${delay}s both` : 'none', transition: 'border-color 0.15s', overflow: 'hidden' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-strong)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 500, letterSpacing: '0.01em' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <div className="mono-num" style={{ fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 600, lineHeight: 1, color, letterSpacing: '-0.03em' }}>{displayed}</div>
        {unit && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{unit}</span>}
      </div>
      <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{sub}</div>
    </div>
  )
}

function Section({ title, children, action, id }) {
  return (
    <div id={id} style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', margin: 0 }}>{title}</h2>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        {action}
      </div>
      {children}
    </div>
  )
}

const primaryBtnStyle = { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: 'var(--accent)', color: 'white' }
const glowBtnStyle = { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--amber-bg)', border: '1px solid var(--amber-border)', color: 'var(--amber)', transition: 'opacity 0.15s' }
const ghostBtnStyle = { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)', transition: 'background 0.15s' }
const subtleBtnStyle = { display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '5px 10px', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontWeight: 500, transition: 'all 0.15s' }
