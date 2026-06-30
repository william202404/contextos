import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plug, Search, ExternalLink, Cpu, Globe, Terminal, CheckCircle, Loader } from 'lucide-react'
import AppRail from '../components/AppRail'
import { DEMO_SERVERS, searchMCPServers, getConnectedServers, saveConnectedServer, removeConnectedServer, getServerToolDefs, isToolEnabled, setToolEnabled } from '../lib/mcp'
import { BUILTIN_SKILLS, installSkillFull } from '../lib/skills'
import { saveProject } from '../store/db'
import { DEFAULT_MODEL } from '../lib/llm'
import SettingsModal, { getUserProfile } from '../components/SettingsModal'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'

const CATEGORIES = ['全部', '搜索', '开发']

// Tool risk levels → badge styling (colors via CSS vars)
const RISK_META = {
  read:  { color: 'var(--green)', bg: 'rgba(52,211,153,0.10)', border: 'rgba(52,211,153,0.25)' },
  write: { color: 'var(--amber)', bg: 'rgba(251,191,36,0.10)', border: 'rgba(251,191,36,0.25)' },
  high:  { color: 'var(--red)',   bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.25)' },
}

const AGENT_TEMPLATES = [
  {
    id: 'research-agent', name: 'AI 研究员', icon: '🔬',
    desc: '联网搜索 + 摘要 + 知识整理，自动完成深度研究任务',
    skillIds: ['literature-distiller'], mcpServerIds: ['brave-search'],
    tags: ['研究', '内容'], model: 'claude-sonnet-4-6',
    systemPrompt: '你是一位专业的 AI 研究助手，擅长通过搜索工具获取最新信息，并进行分析、总结和知识整理。',
  },
  {
    id: 'code-assistant', name: '代码助手', icon: '💻',
    desc: '搜索 GitHub 仓库 + 读取代码文件，在真实代码库中提供帮助',
    skillIds: ['decision-framework'], mcpServerIds: ['github'],
    tags: ['开发', '工程'], model: 'claude-opus-4-8',
    systemPrompt: '你是一位经验丰富的软件工程师，擅长使用 GitHub 工具搜索和分析代码，提供专业的编程建议。',
  },
]

export default function MCPPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [activeCategory, setActiveCategory] = useState('全部')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [servers, setServers] = useState(DEMO_SERVERS)
  const [loading, setLoading] = useState(false)
  const [showGuide, setShowGuide] = useState(null)
  const [connectedIds, setConnectedIds] = useState(() => new Set(getConnectedServers().map(s => s.id)))
  const [deploying, setDeploying] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [keyModal, setKeyModal] = useState(null) // null | { server, value }
  const profile = getUserProfile()
  const displayName = profile.name || 'ContextOS'

  // debounce: 300ms delay
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const fetchServers = useCallback(async (q, cat) => {
    setLoading(true)
    const result = await searchMCPServers(q, cat, 24)
    setServers(result.servers)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchServers(debouncedSearch, activeCategory)
  }, [debouncedSearch, activeCategory, fetchServers])

  function doConnect(server) {
    saveConnectedServer(server)
    setConnectedIds(prev => new Set([...prev, server.id]))
  }

  function handleConnect(server) {
    if (server.keyStore && !localStorage.getItem(server.keyStore)) {
      setKeyModal({ server, value: '' })
      return
    }
    doConnect(server)
  }

  function handleKeySkip() {
    if (!keyModal) return
    doConnect(keyModal.server)
    setKeyModal(null)
  }

  function handleKeySubmit() {
    if (!keyModal?.value?.trim()) return
    localStorage.setItem(keyModal.server.keyStore, keyModal.value.trim())
    doConnect(keyModal.server)
    setKeyModal(null)
  }

  function handleDisconnect(serverId) {
    removeConnectedServer(serverId)
    setConnectedIds(prev => { const next = new Set(prev); next.delete(serverId); return next })
  }

  async function handleDeploy(template) {
    if (deploying) return
    setDeploying(template.id)
    try {
      for (const skillId of template.skillIds) {
        const skill = BUILTIN_SKILLS.find(s => s.id === skillId)
        if (skill) await installSkillFull(skill)
      }
      for (const serverId of template.mcpServerIds) {
        const server = DEMO_SERVERS.find(s => s.id === serverId)
        if (server) {
          saveConnectedServer(server)
          setConnectedIds(prev => new Set([...prev, server.id]))
        }
      }
      const projectId = crypto.randomUUID()
      const now = Date.now()
      await saveProject({
        id: projectId, name: template.name, knowledge: [],
        status: '', model: template.model || DEFAULT_MODEL,
        icon: template.icon, isTemp: false,
        systemPrompt: template.systemPrompt,
        createdAt: now, updatedAt: now,
      })
      navigate(`/project/${projectId}`)
    } catch (e) {
      console.error('Deploy failed', e)
    } finally {
      setDeploying(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--bg-base)' }}>
      {/* Titlebar */}
      <div style={{
        height: 50, flexShrink: 0,
        background: 'var(--bg-titlebar)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
        WebkitAppRegion: window.electronAPI ? 'drag' : undefined,
        paddingLeft: window.electronAPI ? 72 : 0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
          ⬡ {t('nav.mcp')}
        </span>
        <button
          onClick={() => setShowSettings(true)}
          title="设置"
          style={{
            position: 'absolute', right: 16,
            width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
            WebkitAppRegion: 'no-drag',
          }}
        >⚙</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <AppRail activePage="mcp" navigate={navigate} onAvatarClick={() => setShowSettings(true)} displayName={displayName} />

        {/* Main content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '32px 40px' }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid var(--accent-border)',
            }}>
              <Plug size={20} color="white" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{t('mcp.pageTitle')}</h1>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>{t('mcp.pageDesc')}</p>
            </div>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '9px 14px', marginTop: 20,
          }}>
            <Search size={14} color="var(--text-muted)" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('mcp.searchPlaceholder')}
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit' }}
            />
            {loading && <Loader size={13} color="var(--text-muted)" style={{ animation: 'spin 1s linear infinite' }} />}
          </div>

          <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)} style={{
                padding: '5px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: '1px solid',
                borderColor: activeCategory === cat ? 'var(--accent)' : 'var(--border)',
                background: activeCategory === cat ? 'var(--accent-glow)' : 'var(--bg-card)',
                color: activeCategory === cat ? 'var(--accent)' : 'var(--text-secondary)',
                fontWeight: activeCategory === cat ? 600 : 400, transition: 'all 0.15s',
              }}>{cat}</button>
            ))}
          </div>
        </div>

        {/* MCP Server grid */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('mcp.availableTools', { count: servers.length })}
          </h2>
          {servers.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              {t('mcp.noTools')}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {servers.map(server => (
              <MCPCard
                key={server.id}
                server={server}
                connected={connectedIds.has(server.id)}
                onConnect={() => handleConnect(server)}
                onDisconnect={() => handleDisconnect(server.id)}
                onShowGuide={setShowGuide}
              />
            ))}
          </div>
        </section>

        {/* Agent templates */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Cpu size={16} color="var(--accent)" />
            <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('mcp.agentTemplates')}
            </h2>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            {t('mcp.agentTemplatesDesc')}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {AGENT_TEMPLATES.map(template => (
              <AgentTemplateCard
                key={template.id}
                template={template}
                deploying={deploying === template.id}
                onDeploy={() => handleDeploy(template)}
              />
            ))}
          </div>
        </section>
      </main>
      </div>{/* end Body */}

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      {/* API Key modal */}
      {keyModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
          onClick={() => setKeyModal(null)}
        >
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 18, padding: 28, maxWidth: 480, width: '90%',
            boxShadow: 'var(--shadow-lg)',
          }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, color: 'var(--text-primary)', fontWeight: 700 }}>
              {keyModal.server.icon} {i18n.t('mcp.keyModalTitle', { name: keyModal.server.name })}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: 1.65 }}>
              {keyModal.server.keyOptional
                ? i18n.t('mcp.keyOptionalDesc')
                : i18n.t('mcp.keyRequiredDesc')
              }
            </p>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                {keyModal.server.keyLabel}
              </label>
              <input
                type="password"
                autoFocus
                value={keyModal.value}
                onChange={e => setKeyModal(prev => ({ ...prev, value: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleKeySubmit()}
                placeholder={keyModal.server.keyOptional ? i18n.t('mcp.pastePlaceholderOptional') : i18n.t('mcp.pastePlaceholder')}
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 9, fontSize: 13,
                  background: 'var(--bg-input)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--mono)',
                  boxSizing: 'border-box',
                }}
              />
              {keyModal.server.id === 'brave-search' && (
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '8px 0 0', lineHeight: 1.5 }}>
                  {i18n.t('mcp.braveKeyHint')}{' '}
                  <a href="https://brave.com/search/api/" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
                    {i18n.t('mcp.braveKeyLink')}
                  </a>
                  {' '}{i18n.t('mcp.braveKeyHint2')}
                </p>
              )}
              {keyModal.server.id === 'github' && (
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '8px 0 0', lineHeight: 1.5 }}>
                  {i18n.t('mcp.githubKeyHint')}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
              <button onClick={() => setKeyModal(null)} style={{
                padding: '7px 16px', borderRadius: 8, fontSize: 12,
                background: 'var(--bg-hover)', border: '1px solid var(--border)',
                color: 'var(--text-secondary)', cursor: 'pointer',
              }}>{i18n.t('mcp.cancel')}</button>
              {keyModal.server.keyOptional && (
                <button onClick={handleKeySkip} style={{
                  padding: '7px 16px', borderRadius: 8, fontSize: 12,
                  background: 'var(--bg-hover)', border: '1px solid var(--border)',
                  color: 'var(--text-secondary)', cursor: 'pointer',
                }}>{i18n.t('mcp.skipConnect')}</button>
              )}
              <button
                onClick={handleKeySubmit}
                disabled={!keyModal.value.trim()}
                style={{
                  padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: keyModal.value.trim() ? 'var(--accent)' : 'var(--bg-hover)',
                  border: 'none', color: keyModal.value.trim() ? 'white' : 'var(--text-muted)',
                  cursor: keyModal.value.trim() ? 'pointer' : 'default', transition: 'all 0.15s',
                }}
              >{i18n.t('mcp.saveConnect')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Guide modal */}
      {showGuide && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowGuide(null)}
        >
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 18, padding: 28, maxWidth: 520, width: '90%',
            boxShadow: 'var(--shadow-lg)',
          }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, color: 'var(--text-primary)', fontWeight: 700 }}>
              {showGuide.icon} {i18n.t('mcp.guideTitle', { name: showGuide.name })}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: 1.65 }}>
              {i18n.t('mcp.guideDescPart1')}
              <strong style={{ color: 'var(--text-secondary)' }}> {i18n.t('mcp.guideDescBold')}</strong>
              {i18n.t('mcp.guideDescPart2')}
            </p>
            <div style={{
              background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
              borderRadius: 10, padding: '12px 16px', marginBottom: 20,
              fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6,
            }}>
              <div style={{ fontWeight: 600, color: 'var(--amber)', marginBottom: 4 }}>{i18n.t('mcp.guideSoon')}</div>
              {i18n.t('mcp.guideNextVersion')}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <a
                href={`https://github.com/modelcontextprotocol/servers/tree/main/src/${showGuide.id}`}
                target="_blank" rel="noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, fontSize: 12,
                  color: 'var(--accent)', textDecoration: 'none',
                  padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)',
                  background: 'var(--accent-glow)',
                }}
              >
                <ExternalLink size={11} /> {i18n.t('mcp.viewDocs')}
              </a>
              <button onClick={() => setShowGuide(null)} style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 12,
                background: 'var(--bg-hover)', border: '1px solid var(--border)',
                color: 'var(--text-secondary)', cursor: 'pointer',
              }}>{i18n.t('mcp.close')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MCPCard({ server, connected, onConnect, onDisconnect, onShowGuide }) {
  const { t } = useTranslation()
  const isHTTP = server.type === 'http'
  const needsKey = !!server.keyStore
  const hasKey = needsKey && !!localStorage.getItem(server.keyStore)

  const toolDefs = getServerToolDefs(server.id)
  // disabledMap[toolName] === true means the tool is turned off
  const [disabledMap, setDisabledMap] = useState(() => {
    const m = {}
    toolDefs.forEach(td => { m[td.name] = !isToolEnabled(server.id, td.name) })
    return m
  })

  function toggleTool(name) {
    setDisabledMap(prev => {
      const willDisable = !prev[name]
      setToolEnabled(server.id, name, !willDisable)
      return { ...prev, [name]: willDisable }
    })
  }

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid',
      borderColor: connected ? 'var(--accent)' : 'var(--border)',
      borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 12,
      transition: 'all 0.15s',
    }}
    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
    onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card)' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ fontSize: 24, lineHeight: 1 }}>{server.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{server.name}</span>
            <span style={{
              fontSize: 10, padding: '1px 7px', borderRadius: 10, fontWeight: 600,
              background: isHTTP ? 'rgba(52,211,153,0.1)' : 'rgba(251,191,36,0.1)',
              color: isHTTP ? 'var(--green)' : 'var(--amber)',
              border: `1px solid ${isHTTP ? 'rgba(52,211,153,0.2)' : 'rgba(251,191,36,0.2)'}`,
              display: 'flex', alignItems: 'center', gap: 3,
            }}>
              {isHTTP ? <Globe size={8} /> : <Terminal size={8} />}
              {isHTTP ? 'HTTP' : 'stdio'}
            </span>
            {needsKey && !hasKey && !connected && (
              <span style={{
                fontSize: 10, padding: '1px 7px', borderRadius: 10, fontWeight: 600,
                background: 'var(--accent-glow)', color: 'var(--accent)',
                border: '1px solid rgba(61,142,245,0.2)',
              }}>{server.keyOptional ? t('mcp.optionalToken') : t('mcp.needsApiKey')}</span>
            )}
            {connected && (
              <CheckCircle size={13} color="var(--accent)" style={{ marginLeft: 'auto' }} />
            )}
          </div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{server.desc}</p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-muted)' }}>
        <span>{server.tools}</span>
        {server.stars > 0 && <><span>·</span><span>★ {server.stars.toLocaleString()}</span></>}
        <div style={{ marginLeft: 'auto' }}>
          {isHTTP ? (
            <button
              onClick={connected ? onDisconnect : onConnect}
              style={{
                fontSize: 12, padding: '5px 14px', borderRadius: 8, cursor: 'pointer',
                fontWeight: 600, border: '1px solid',
                background: connected ? 'var(--accent-glow)' : 'var(--accent)',
                borderColor: connected ? 'var(--border-strong)' : 'transparent',
                color: connected ? 'var(--accent)' : 'white',
                transition: 'all 0.15s',
              }}
            >
              {connected ? t('mcp.connected') : (needsKey && !hasKey && !server.keyOptional ? t('mcp.configKey') : t('mcp.connect'))}
            </button>
          ) : (
            <button
              onClick={() => onShowGuide(server)}
              style={{
                fontSize: 12, padding: '5px 14px', borderRadius: 8, cursor: 'pointer',
                background: 'var(--bg-hover)', border: '1px solid var(--border)',
                color: 'var(--text-secondary)', fontWeight: 500, transition: 'all 0.15s',
              }}
            >
              {t('mcp.viewDetail')}
            </button>
          )}
        </div>
      </div>

      {connected && toolDefs.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('mcp.toolPermissions')}
          </div>
          {toolDefs.map(td => {
            const rm = RISK_META[td.risk] || RISK_META.read
            const enabled = !disabledMap[td.name]
            return (
              <div key={td.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 11, flex: 1, fontFamily: 'var(--mono)',
                  color: enabled ? 'var(--text-secondary)' : 'var(--text-muted)',
                  textDecoration: enabled ? 'none' : 'line-through', opacity: enabled ? 1 : 0.6,
                }}>{td.name}</span>
                <span style={{
                  fontSize: 9, padding: '1px 6px', borderRadius: 8, fontWeight: 600,
                  color: rm.color, background: rm.bg, border: `1px solid ${rm.border}`,
                }}>{t(`mcp.risk_${td.risk}`)}</span>
                <button
                  onClick={() => toggleTool(td.name)}
                  title={enabled ? t('mcp.disableTool') : t('mcp.enableTool')}
                  style={{
                    width: 32, height: 18, borderRadius: 10, border: 'none', cursor: 'pointer',
                    position: 'relative', flexShrink: 0, padding: 0,
                    background: enabled ? 'var(--accent)' : 'var(--bg-hover)', transition: 'background 0.15s',
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 2, left: enabled ? 16 : 2,
                    width: 14, height: 14, borderRadius: '50%', background: 'white', transition: 'left 0.15s',
                  }} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function AgentTemplateCard({ template, deploying, onDeploy }) {
  const { t } = useTranslation()
  const sep = i18n.language === 'zh' ? '、' : ', '
  const toolNames = template.mcpServerIds.map(id => DEMO_SERVERS.find(s => s.id === id)?.name || id).join(sep)
  const skillNames = template.skillIds.map(id => BUILTIN_SKILLS.find(s => s.id === id)?.name || id).join(sep)

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 14, padding: 18, transition: 'all 0.15s',
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-card)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 22 }}>{template.icon}</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{template.name}</div>
          <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
            {template.tags.map(tag => (
              <span key={tag} style={{
                fontSize: 10, padding: '1px 6px', borderRadius: 4,
                background: 'var(--accent-glow)', color: 'var(--accent)', fontWeight: 500,
              }}>{tag}</span>
            ))}
          </div>
        </div>
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{template.desc}</p>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div>{t('mcp.toolsList', { names: toolNames })}</div>
        <div>{t('mcp.skillsList', { names: skillNames })}</div>
      </div>
      <button
        onClick={onDeploy}
        disabled={deploying}
        style={{
          width: '100%', padding: '8px 0', borderRadius: 9, fontSize: 12, fontWeight: 600,
          cursor: deploying ? 'default' : 'pointer',
          background: deploying ? 'var(--bg-hover)' : 'var(--accent)',
          border: 'none', color: deploying ? 'var(--text-muted)' : 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          transition: 'all 0.15s',
        }}
      >
        {deploying ? (
          <><Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> {t('mcp.deploying')}</>
        ) : (
          t('mcp.deployBtn')
        )}
      </button>
    </div>
  )
}
