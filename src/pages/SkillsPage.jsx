import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutDashboard, FolderOpen, MessageSquare, Sparkles, Settings, Search, Download, Check, Zap, Cloud, Trash2, Plug, X } from 'lucide-react'
import { BUILTIN_SKILLS, SKILL_CATEGORIES, getInstalledSkills, installSkillFull, uninstallSkillFull } from '../lib/skills'
import { searchSkillHub, normalizeSkillHubSkill } from '../lib/skillhub'
import { getUserProfile } from '../components/SettingsModal'
import SettingsModal from '../components/SettingsModal'

export default function SkillsPage() {
  const navigate = useNavigate()
  const [activeCategory, setActiveCategory] = useState('全部')
  const [installedSkills, setInstalledSkills] = useState([])
  const [activeTab, setActiveTab] = useState('market') // 'market' | 'installed'
  const [search, setSearch] = useState('')
  const [skillhubSkills, setSkillhubSkills] = useState([])
  const [skillhubLoading, setSkillhubLoading] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [installingId, setInstallingId] = useState(null)
  const [selectedSkill, setSelectedSkill] = useState(null)

  const profile = getUserProfile()
  const displayName = profile.name || 'ContextOS'
  const displayRole = profile.role || '欢迎使用'

  const installedIds = installedSkills.map(s => s.id)

  async function loadInstalled() {
    setInstalledSkills(await getInstalledSkills())
  }

  async function loadSkillHub(q = '') {
    setSkillhubLoading(true)
    try {
      const results = await searchSkillHub(q, 60)
      setSkillhubSkills(results.map(normalizeSkillHubSkill))
    } catch {
      // SkillHub unavailable — silently fall back to BUILTIN_SKILLS only
      setSkillhubSkills([])
    } finally {
      setSkillhubLoading(false)
    }
  }

  useEffect(() => { loadInstalled() }, [])

  // 搜索防抖：首次立即加载，后续输入 500ms 延迟
  useEffect(() => {
    const t = setTimeout(() => loadSkillHub(search), search ? 500 : 0)
    return () => clearTimeout(t)
  }, [search])

  const allSkills = [...BUILTIN_SKILLS, ...skillhubSkills]

  const filtered = allSkills.filter(s => {
    const matchCat = activeCategory === '全部' || s.category === activeCategory
    const matchSearch = !search || s.name.includes(search) || s.desc.includes(search)
    return matchCat && matchSearch
  })

  const featured = allSkills.filter(s => ['pm-assistant', 'competitive-analysis', 'decision-framework', 'knowledge-extractor'].includes(s.id))

  async function handleToggleInstall(skill, e) {
    e?.stopPropagation()
    if (installedIds.includes(skill.id)) {
      await uninstallSkillFull(skill.id)
      await loadInstalled()
    } else {
      setInstallingId(skill.id)
      await installSkillFull(skill)
      await loadInstalled()
      // Brief visual feedback before clearing
      await new Promise(r => setTimeout(r, 600))
      setInstallingId(null)
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-base)' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, minWidth: 220,
        background: window.electronAPI ? 'transparent' : 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', padding: '18px 0',
        WebkitAppRegion: 'drag',
      }}>
        <div style={{ padding: '0 18px 24px', display: 'flex', alignItems: 'center', gap: 9, paddingTop: window.electronAPI ? 44 : undefined, WebkitAppRegion: 'no-drag' }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid var(--accent-border)',
          }}>
            <span style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>C</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Context<span style={{ color: 'var(--accent)' }}>OS</span>
          </div>
        </div>

        <nav style={{ padding: '0 10px', flex: 1, WebkitAppRegion: 'no-drag' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', padding: '0 8px', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            工作台
          </div>
          <NavItem icon={<LayoutDashboard size={15} />} label="概览" onClick={() => navigate('/')} />
          <NavItem icon={<FolderOpen size={15} />} label="项目空间" onClick={() => navigate('/')} />
          <NavItem icon={<MessageSquare size={15} />} label="对话" onClick={() => navigate('/')} />
          <NavItem icon={<Sparkles size={15} />} label="技能" active />
          <NavItem icon={<Plug size={15} />} label="MCP 工具" onClick={() => navigate('/mcp')} />
        </nav>

        <div style={{ padding: '10px 10px 0', borderTop: '1px solid var(--border)', WebkitAppRegion: 'no-drag' }}>
          <div
            onClick={() => setShowSettings(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, var(--accent), var(--teal))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: 'white',
              border: '1px solid var(--accent-border)',
            }}>
              {displayName.charAt(0).toUpperCase() || 'U'}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{displayRole}</div>
            </div>
            <Settings size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-base)' }}>
        {/* Hero search bar */}
        <div style={{
          background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)',
          padding: '28px 40px 20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                技能市场
              </h1>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                {allSkills.length} 个可用技能 · {installedIds.length} 个已安装
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {['market', 'installed'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', border: activeTab === tab ? 'none' : '1px solid var(--border)',
                    background: activeTab === tab ? 'var(--accent)' : 'var(--bg-card)',
                    color: activeTab === tab ? 'white' : 'var(--text-secondary)',
                    transition: 'all 0.15s',
                  }}
                >
                  {tab === 'market' ? '技能市场' : `已安装 ${installedIds.length}`}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--bg-base)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '9px 14px',
            transition: 'border-color 0.15s',
          }}
            onFocusCapture={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
            onBlurCapture={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
          >
            <Search size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索技能名称或描述…"
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit',
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, fontSize: 13 }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div style={{ padding: '24px 40px' }}>
          {/* 已安装 tab */}
          {activeTab === 'installed' && (
            <InstalledTab
              skills={installedSkills}
              onUninstall={async (skill) => { await uninstallSkillFull(skill.id); await loadInstalled() }}
            />
          )}

          {activeTab === 'market' && <>
          {/* SkillHub 公开技能（仅在加载中或有结果时显示） */}
          {(skillhubLoading || skillhubSkills.length > 0) && (
            <div style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <Cloud size={14} color="var(--accent)" />
                <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>SkillHub 社区技能</h2>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                {skillhubLoading && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>加载中…</span>}
              </div>
              {skillhubSkills.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  {skillhubSkills.slice(0, 8).map(skill => (
                    <FeaturedCard key={skill.id} skill={skill} installed={installedIds.includes(skill.id)}
                      installing={installingId === skill.id}
                      onSelect={setSelectedSkill} onToggle={handleToggleInstall} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Featured (always shown) */}
          {!search && (
            <div style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <Zap size={14} color="#d97706" />
                <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>热门推荐</h2>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {featured.map(skill => (
                  <FeaturedCard key={skill.id} skill={skill} installed={installedIds.includes(skill.id)}
                    installing={installingId === skill.id}
                    onSelect={setSelectedSkill} onToggle={handleToggleInstall} />
                ))}
              </div>
            </div>
          )}

          {/* Category tabs + grid */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                {search ? `搜索结果 · ${filtered.length} 个` : '全部技能'}
              </h2>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            {/* Category pills */}
            {!search && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                {SKILL_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    style={{
                      padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                      cursor: 'pointer', transition: 'all 0.15s',
                      border: activeCategory === cat ? 'none' : '1px solid var(--border)',
                      background: activeCategory === cat ? 'var(--accent)' : 'var(--bg-card)',
                      color: activeCategory === cat ? 'white' : 'var(--text-secondary)',
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {filtered.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '48px 0',
                background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)',
              }}>
                <Search size={24} color="var(--text-muted)" style={{ margin: '0 auto 10px' }} />
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>没有找到匹配的技能</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                {filtered.map(skill => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    installed={installedIds.includes(skill.id)}
                    installing={installingId === skill.id}
                    onSelect={setSelectedSkill}
                    onToggle={handleToggleInstall}
                  />
                ))}
              </div>
            )}
          </div>
          </>}
        </div>
      </main>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {selectedSkill && (
        <SkillDetailModal
          skill={selectedSkill}
          installed={installedIds.includes(selectedSkill.id)}
          onClose={() => setSelectedSkill(null)}
          onToggle={() => { handleToggleInstall(selectedSkill); }}
        />
      )}
    </div>
  )
}

function FeaturedCard({ skill, installed, installing, onSelect, onToggle }) {
  return (
    <div
      onClick={() => onSelect(skill)}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 12, padding: '16px',
        cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s',
        display: 'flex', flexDirection: 'column', gap: 6,
        position: 'relative',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-card)' }}
    >
      <div style={{ fontSize: 26, marginBottom: 2 }}>{skill.icon}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{skill.name}</div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, flex: 1,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {skill.desc}
      </div>
      <button
        onClick={e => onToggle(skill, e)}
        disabled={installing}
        style={{
          position: 'absolute', top: 12, right: 12,
          width: 26, height: 26, borderRadius: 6, border: 'none',
          background: installed ? 'var(--accent-glow)' : 'rgba(255,255,255,0.8)',
          color: installed ? 'var(--accent)' : 'var(--text-muted)',
          cursor: installing ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s',
        }}
        title={installed ? '卸载' : '安装'}
      >
        {installing
          ? <span style={{ width: 10, height: 10, border: '1.5px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
          : installed ? <Check size={12} /> : <Download size={12} />
        }
      </button>
    </div>
  )
}

function SkillCard({ skill, installed, installing, onSelect, onToggle }) {
  return (
    <div
      onClick={() => onSelect(skill)}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 14, padding: '20px 20px 16px',
        display: 'flex', flexDirection: 'column', gap: 10,
        transition: 'border-color 0.15s, background 0.15s', cursor: 'pointer',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-card)' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: 'var(--bg-hover)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, border: '1px solid var(--border)',
        }}>
          {skill.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            {skill.name}
          </div>
          <span style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 10,
            background: 'var(--bg-hover)', color: 'var(--text-secondary)',
            fontWeight: 600, border: '1px solid var(--border)',
            display: 'inline-block',
          }}>
            {skill.category}
          </span>
          {skill.source === 'skillhub' && (
            <span style={{
              fontSize: 9, padding: '2px 6px', borderRadius: 10, marginLeft: 4,
              background: 'var(--accent-glow)', color: 'var(--accent)',
              fontWeight: 600, border: '1px solid var(--border)',
              display: 'inline-block',
            }}>
              SkillHub
            </span>
          )}
        </div>
      </div>

      {/* Desc */}
      <div style={{
        fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.65, flex: 1,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {skill.desc}
      </div>

      {/* Actions */}
      <button
        onClick={e => { e.stopPropagation(); onToggle(skill, e) }}
        disabled={installing}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '8px 0', borderRadius: 9, fontSize: 12.5, fontWeight: 600,
          cursor: installing ? 'default' : 'pointer', transition: 'all 0.15s', marginTop: 2,
          border: installed ? '1px solid var(--accent-border)' : '1px solid var(--border)',
          background: installed ? 'var(--accent-light)' : 'var(--bg-card)',
          color: installed ? 'var(--accent)' : 'var(--text-secondary)',
        }}
      >
        {installing
          ? <><span style={{ width: 11, height: 11, border: '1.5px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> 配置中…</>
          : installed ? <><Check size={13} /> 已安装</> : <><Download size={13} /> 安装到技能库</>
        }
      </button>
      {installed && (
        <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', marginTop: 5 }}>
          技能通过 AI 提示词工作，安装即时生效
        </div>
      )}
    </div>
  )
}

function InstalledTab({ skills, onUninstall }) {
  if (skills.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📦</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>还没有安装任何技能</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>去技能市场浏览并安装技能，安装后在项目对话顶部的技能栏中激活</div>
      </div>
    )
  }
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 12, color: 'var(--text-muted)', marginBottom: 16,
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '8px 12px',
      }}>
        <span style={{ fontSize: 14 }}>💡</span>
        已安装 {skills.length} 个技能 · 在项目对话顶部的<b style={{ color: 'var(--text-secondary)' }}>技能栏</b>中选择激活
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {skills.map(skill => (
          <div key={skill.id} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 14, padding: '20px 20px 16px',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: 'var(--bg-hover)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, border: '1px solid var(--border)',
              }}>
                {skill.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{skill.name}</div>
                <span style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 10,
                  background: 'var(--bg-hover)', color: 'var(--text-secondary)',
                  fontWeight: 600, border: '1px solid var(--border)', display: 'inline-block',
                }}>{skill.category}</span>
                {skill.source === 'skillhub' && (
                  <span style={{
                    fontSize: 9, padding: '2px 6px', borderRadius: 10, marginLeft: 4,
                    background: 'var(--accent-glow)', color: 'var(--accent)',
                    fontWeight: 600, border: '1px solid var(--border)', display: 'inline-block',
                  }}>SkillHub</span>
                )}
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
              {skill.desc}
            </div>
            <button
              onClick={() => onUninstall(skill)}
              title="卸载"
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                padding: '7px 0', borderRadius: 9, fontSize: 12, fontWeight: 500,
                cursor: 'pointer', transition: 'all 0.15s', marginTop: 2,
                border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.borderColor = 'var(--red)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}
            >
              <Trash2 size={12} /> 卸载
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function SkillDetailModal({ skill, installed, onClose, onToggle }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 20, width: 480, maxWidth: '90vw',
        boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '24px 24px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14, flexShrink: 0,
              background: 'var(--bg-hover)',
              border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
            }}>{skill.icon}</div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{skill.name}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {skill.category && (
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontWeight: 600, border: '1px solid var(--border)' }}>
                    {skill.category}
                  </span>
                )}
                {skill.source === 'skillhub' && (
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'var(--accent-glow)', color: 'var(--accent)', fontWeight: 600, border: '1px solid var(--border)' }}>
                    SkillHub
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, marginTop: -4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 24px 24px' }}>
          <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.75, margin: '0 0 16px' }}>
            {skill.fullDesc || skill.desc}
          </p>

          {skill.systemPrompt && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>AI 角色设定</div>
              <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '10px 14px',
                fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6,
                maxHeight: 80, overflow: 'hidden',
                display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
              }}>
                {skill.systemPrompt}
              </div>
            </div>
          )}

          {/* Actions */}
          <button
            onClick={() => { onToggle(); }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              padding: '11px 0', borderRadius: 10, fontSize: 13.5, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s',
              border: installed ? '1px solid var(--accent-border)' : 'none',
              background: installed ? 'var(--accent-light)' : 'var(--accent)',
              color: installed ? 'var(--accent)' : 'white',
            }}
          >
            {installed ? <><Check size={15} /> 已安装到技能库</> : <><Download size={15} /> 安装到技能库</>}
          </button>
          {installed && (
            <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--text-muted)', textAlign: 'center' }}>
              在项目对话顶部的技能栏中即可激活此技能
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function NavItem({ icon, label, active, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '7px 8px', borderRadius: 7,
        cursor: onClick ? 'pointer' : 'default',
        fontSize: 13, marginBottom: 2,
        transition: 'background 0.15s, color 0.15s',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
        background: active ? 'var(--accent-glow)' : 'transparent',
        fontWeight: active ? 600 : 400,
      }}
      onMouseEnter={e => { if (!active && onClick) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)' } }}
      onMouseLeave={e => { if (!active && onClick) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' } }}
    >
      <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
    </div>
  )
}
