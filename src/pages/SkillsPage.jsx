import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BUILTIN_SKILLS, SKILL_CATEGORIES, getInstalledSkills, installSkillFull, uninstallSkillFull } from '../lib/skills'
import { searchSkillHub, normalizeSkillHubSkill } from '../lib/skillhub'
import { getUserProfile } from '../components/SettingsModal'
import SettingsModal from '../components/SettingsModal'
import AppRail from '../components/AppRail'

const isElectron = !!window.electronAPI

// Featured skills shown in "核心技能" section
const CORE_IDS = ['pm-assistant', 'competitive-analysis', 'project-retro', 'user-research', 'literature-distiller', 'upward-communication']
const CONTEXTOS_IDS = ['knowledge-extractor', 'context-optimizer']
const BADGE_MAP = {
  'pm-assistant': { label: 'HOT', color: 'var(--amber)', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.25)' },
  'competitive-analysis': { label: 'CORE', color: 'var(--accent-raw)', bg: 'var(--accent-dim)', border: 'var(--accent-border)' },
  'knowledge-extractor': { label: '专属', color: 'var(--accent-raw)', bg: 'var(--accent-dim)', border: 'var(--accent-border)' },
}

export default function SkillsPage() {
  const navigate = useNavigate()
  const [activeCategory, setActiveCategory] = useState('全部')
  const [installedSkills, setInstalledSkills] = useState([])
  const [activeTab, setActiveTab] = useState('all') // 'all' | 'installed'
  const [search, setSearch] = useState('')
  const [skillhubSkills, setSkillhubSkills] = useState([])
  const [installingId, setInstallingId] = useState(null)
  const [showSettings, setShowSettings] = useState(false)

  const profile = getUserProfile()
  const displayName = profile.name || 'U'
  const installedIds = installedSkills.map(s => s.id)

  async function loadInstalled() {
    setInstalledSkills(await getInstalledSkills())
  }

  async function loadSkillHub(q = '') {
    try {
      const results = await searchSkillHub(q, 40)
      setSkillhubSkills(results.map(normalizeSkillHubSkill))
    } catch {
      setSkillhubSkills([])
    }
  }

  useEffect(() => { loadInstalled() }, [])
  useEffect(() => {
    const timer = setTimeout(() => loadSkillHub(search), search ? 500 : 0)
    return () => clearTimeout(timer)
  }, [search])

  const allSkills = [...BUILTIN_SKILLS, ...skillhubSkills.filter(s => !BUILTIN_SKILLS.find(b => b.id === s.id))]

  const filtered = allSkills.filter(s => {
    const matchCat = activeCategory === '全部' || s.category === activeCategory
    const matchSearch = !search || s.name.includes(search) || (s.desc || '').includes(search)
    return matchCat && matchSearch
  })

  const coreSkills = allSkills.filter(s => CORE_IDS.includes(s.id) && !installedIds.includes(s.id))
  const contextosSkills = allSkills.filter(s => CONTEXTOS_IDS.includes(s.id) && !installedIds.includes(s.id))
  const moreSkills = allSkills.filter(s =>
    !CORE_IDS.includes(s.id) && !CONTEXTOS_IDS.includes(s.id) && !installedIds.includes(s.id) && !skillhubSkills.find(h => h.id === s.id)
  )

  async function handleToggleInstall(skill, e) {
    e?.stopPropagation()
    if (installedIds.includes(skill.id)) {
      await uninstallSkillFull(skill.id)
      await loadInstalled()
    } else {
      setInstallingId(skill.id)
      await installSkillFull(skill)
      await loadInstalled()
      await new Promise(r => setTimeout(r, 600))
      setInstallingId(null)
    }
  }

  const categoryCounts = SKILL_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = cat === '全部' ? allSkills.length : allSkills.filter(s => s.category === cat).length
    return acc
  }, {})

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
          color: 'var(--text-primary)', letterSpacing: '-0.01em',
          WebkitAppRegion: 'no-drag',
        }}>
          ContextOS
        </div>
      </div>

      {/* 主体 */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Rail */}
        <AppRail activePage="skills" navigate={navigate} onAvatarClick={() => setShowSettings(true)} displayName={displayName} />

        {/* 内容区 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* 顶部工具栏 */}
          <div style={{
            padding: '16px 28px 0',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                技能库
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                为项目安装专属能力增强器，技能附着在项目上全局生效
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* 搜索框 */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '6px 10px', minWidth: 180, cursor: 'text',
              }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>⌕</span>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="搜索技能…"
                  style={{
                    flex: 1, border: 'none', outline: 'none', background: 'transparent',
                    fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-body)',
                  }}
                />
                {search && (
                  <button onClick={() => setSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, fontSize: 11 }}>✕</button>
                )}
              </div>
              {/* 筛选 tabs */}
              <div style={{
                display: 'flex', gap: 2, background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 8, padding: 3,
              }}>
                {[{ key: 'all', label: '全部' }, { key: 'installed', label: '已安装' }].map(tab => (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                    padding: '4px 10px', borderRadius: 5,
                    fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 600,
                    color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
                    background: activeTab === tab.key ? 'var(--bg-hover)' : 'transparent',
                    border: 'none', cursor: 'pointer',
                  }}>{tab.label}</button>
                ))}
              </div>
            </div>
          </div>

          {/* 分类导航 */}
          <div style={{
            display: 'flex', gap: 6, padding: '14px 28px 0',
            flexShrink: 0, overflowX: 'auto',
          }}>
            {SKILL_CATEGORIES.filter(c => (categoryCounts[c] || 0) > 0 || c === '全部').map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 12px', borderRadius: 20,
                border: '1px solid', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 600,
                transition: 'all 0.12s',
                borderColor: activeCategory === cat ? 'var(--accent-border)' : 'var(--border)',
                background: activeCategory === cat ? 'var(--accent-dim)' : 'transparent',
                color: activeCategory === cat ? 'var(--accent-raw)' : 'var(--text-secondary)',
              }}>
                {cat}
                {categoryCounts[cat] > 0 && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 400, opacity: 0.6 }}>
                    {categoryCounts[cat]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* 内容滚动区 */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 28px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* 已安装 tab */}
            {activeTab === 'installed' && (
              installedSkills.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>📦</div>
                  <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)' }}>还没有安装的技能</div>
                  <div>在市场中找到合适的技能，点击安装即可</div>
                </div>
              ) : (
                <div>
                  <SectionHeader title="已安装" />
                  <InstalledList
                    skills={installedSkills}
                    onUninstall={s => handleToggleInstall(s)}
                    onUse={() => navigate('/')}
                  />
                </div>
              )
            )}

            {/* 全部 tab */}
            {activeTab === 'all' && (
              search || activeCategory !== '全部' ? (
                /* 搜索 / 分类过滤模式 */
                <div>
                  <SectionHeader title={search ? `搜索结果 · ${filtered.length} 个` : `${activeCategory}`} />
                  {filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                      未找到匹配的技能
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                      {filtered.map(s => (
                        <StoreCard key={s.id} skill={s} installed={installedIds.includes(s.id)}
                          installing={installingId === s.id} onToggle={handleToggleInstall}
                          featured={CORE_IDS.slice(0, 2).includes(s.id)} />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* 全量分区模式 */
                <>
                  {/* 已安装区 */}
                  {installedSkills.length > 0 && (
                    <div>
                      <SectionHeader title="已安装" />
                      <InstalledList
                        skills={installedSkills}
                        onUninstall={s => handleToggleInstall(s)}
                        onUse={() => navigate('/')}
                      />
                    </div>
                  )}

                  {/* 核心技能 */}
                  {coreSkills.length > 0 && (
                    <div>
                      <SectionHeader title="核心技能 · 知识工作者必备" />
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                        {coreSkills.map(s => (
                          <StoreCard key={s.id} skill={s} installed={false}
                            installing={installingId === s.id} onToggle={handleToggleInstall}
                            featured={['competitive-analysis', 'pm-assistant'].includes(s.id)} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ContextOS 专属 */}
                  {contextosSkills.length > 0 && (
                    <div>
                      <SectionHeader title="ContextOS 专属" />
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                        {contextosSkills.map(s => (
                          <StoreCard key={s.id} skill={s} installed={false}
                            installing={installingId === s.id} onToggle={handleToggleInstall}
                            featured />
                        ))}
                        {/* 即将上线占位 */}
                        <div style={{
                          background: 'var(--bg-card)', border: '1px solid var(--border)',
                          borderRadius: 12, padding: 16, opacity: 0.7,
                          display: 'flex', flexDirection: 'column', gap: 10,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                            <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--bg-hover)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🔬</div>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 600, padding: '2px 5px', borderRadius: 3, background: 'rgba(126,134,158,0.08)', border: '1px solid rgba(126,134,158,0.2)', color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>即将上线</span>
                          </div>
                          <div>
                            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>意图识别器</div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>自动判断对话意图，智能决定注入多少上下文。</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>ContextOS · 意图感知</span>
                            <button disabled style={{ padding: '5px 12px', borderRadius: 6, fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 600, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'default' }}>敬请期待</button>
                          </div>
                        </div>
                        {/* 自定义技能 */}
                        <div
                          style={{
                            background: 'transparent', border: '1px dashed var(--border)',
                            borderRadius: 12, padding: 16,
                            display: 'flex', alignItems: 'center', gap: 12,
                            cursor: 'pointer', transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-border)'; e.currentTarget.style.background = 'var(--accent-glow)' }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'transparent' }}
                        >
                          <div style={{ width: 36, height: 36, borderRadius: 9, border: '1px dashed var(--border)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>+</div>
                          <div>
                            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 2 }}>创建自定义技能</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.7 }}>编写 system prompt，定义专属 AI 角色</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 更多技能 */}
                  {moreSkills.length > 0 && (
                    <div>
                      <SectionHeader title="更多技能" />
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                        {moreSkills.map(s => (
                          <StoreCard key={s.id} skill={s} installed={false}
                            installing={installingId === s.id} onToggle={handleToggleInstall} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SkillHub 社区技能 */}
                  {skillhubSkills.filter(s => !installedIds.includes(s.id)).length > 0 && (
                    <div>
                      <SectionHeader title="SkillHub 社区" />
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                        {skillhubSkills.filter(s => !installedIds.includes(s.id)).slice(0, 6).map(s => (
                          <StoreCard key={s.id} skill={s} installed={false}
                            installing={installingId === s.id} onToggle={handleToggleInstall} />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )
            )}

          </div>
        </div>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}


function SectionHeader({ title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        {title}
      </div>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  )
}

function InstalledList({ skills, onUninstall, onUse }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {skills.map(skill => (
        <div key={skill.id} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 12px', borderRadius: 9,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          transition: 'all 0.12s', cursor: 'default',
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-card)' }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, background: 'var(--bg-hover)', border: '1px solid var(--border)',
          }}>
            {skill.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 1 }}>{skill.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{skill.desc}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <button onClick={onUse} style={{
              padding: '6px 12px', borderRadius: 6,
              fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 600,
              color: 'var(--accent-raw)', borderColor: 'var(--accent-border)',
              background: 'var(--accent-dim)', border: '1px solid var(--accent-border)',
              cursor: 'pointer', transition: 'all 0.12s',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(61,142,245,0.18)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--accent-dim)'}
            >使用</button>
            <button onClick={() => onUninstall(skill)} style={{
              padding: '6px 12px', borderRadius: 6,
              fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 600,
              color: 'var(--text-muted)', border: '1px solid var(--border)',
              background: 'transparent', cursor: 'pointer', transition: 'all 0.12s',
            }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.borderColor = 'rgba(248,113,113,0.3)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}
            >卸载</button>
          </div>
        </div>
      ))}
    </div>
  )
}

function StoreCard({ skill, installed, installing, onToggle, featured = false }) {
  const badge = BADGE_MAP[skill.id]
  return (
    <div style={{
      background: featured ? 'linear-gradient(135deg, rgba(61,142,245,0.04) 0%, var(--bg-card) 60%)' : 'var(--bg-card)',
      border: '1px solid', borderColor: featured ? 'var(--accent-border)' : 'var(--border)',
      borderRadius: 12, padding: 16, cursor: 'default',
      display: 'flex', flexDirection: 'column', gap: 10,
      position: 'relative', overflow: 'hidden', transition: 'all 0.15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)'; e.currentTarget.style.borderColor = featured ? 'var(--accent-border)' : 'var(--border-strong)'; e.currentTarget.style.background = featured ? 'linear-gradient(135deg, rgba(61,142,245,0.06) 0%, var(--bg-hover) 60%)' : 'var(--bg-hover)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = featured ? 'var(--accent-border)' : 'var(--border)'; e.currentTarget.style.background = featured ? 'linear-gradient(135deg, rgba(61,142,245,0.04) 0%, var(--bg-card) 60%)' : 'var(--bg-card)' }}
    >
      {featured && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, var(--accent-raw), transparent)' }} />
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--bg-hover)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
          {skill.icon}
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {badge && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 600,
              padding: '2px 5px', borderRadius: 3, letterSpacing: '0.04em', textTransform: 'uppercase',
              background: badge.bg, border: `1px solid ${badge.border}`, color: badge.color,
            }}>{badge.label}</span>
          )}
        </div>
      </div>
      <div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{skill.name}</div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{skill.desc}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>
          {skill.category}{skill.source === 'skillhub' ? ' · SkillHub' : ''}
        </span>
        {installed ? (
          <button disabled style={{ padding: '5px 12px', borderRadius: 6, fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 600, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'default' }}>已安装</button>
        ) : (
          <button
            onClick={e => onToggle(skill, e)}
            disabled={installing}
            style={{
              padding: '5px 12px', borderRadius: 6,
              fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 600,
              background: 'var(--accent-dim)', border: '1px solid var(--accent-border)',
              color: 'var(--accent-raw)', cursor: installing ? 'default' : 'pointer',
              transition: 'all 0.12s', display: 'flex', alignItems: 'center', gap: 5,
            }}
            onMouseEnter={e => { if (!installing) e.currentTarget.style.background = 'rgba(61,142,245,0.18)' }}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--accent-dim)'}
          >
            {installing
              ? <span style={{ width: 10, height: 10, border: '1.5px solid var(--accent-raw)', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
              : '安装'
            }
          </button>
        )}
      </div>
    </div>
  )
}
