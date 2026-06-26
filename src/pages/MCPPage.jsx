import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plug, Sparkles, LayoutDashboard, FolderOpen, MessageSquare, Settings, Search, ExternalLink, Cpu, Globe, Terminal, CheckCircle, Loader } from 'lucide-react'
import { DEMO_SERVERS, searchMCPServers, getConnectedServers, saveConnectedServer, removeConnectedServer } from '../lib/mcp'
import { BUILTIN_SKILLS, installSkillFull } from '../lib/skills'
import { saveProject } from '../store/db'
import { DEFAULT_MODEL } from '../lib/llm'
import SettingsModal, { getUserProfile } from '../components/SettingsModal'

const CATEGORIES = ['全部', '搜索', '开发']

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
  const displayRole = profile.role || '欢迎使用'

  // 防抖：300ms 后才更新 debouncedSearch
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
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
      // keyOptional: prompt but allow skipping; !keyOptional: must fill
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
      // Install skills
      for (const skillId of template.skillIds) {
        const skill = BUILTIN_SKILLS.find(s => s.id === skillId)
        if (skill) await installSkillFull(skill)
      }
      // Connect MCP servers
      for (const serverId of template.mcpServerIds) {
        const server = DEMO_SERVERS.find(s => s.id === serverId)
        if (server) {
          saveConnectedServer(server)
          setConnectedIds(prev => new Set([...prev, server.id]))
        }
      }
      // Create project
      const projectId = crypto.randomUUID()
      const now = Date.now()
      await saveProject({
        id: projectId, name: template.name, knowledge: template.desc,
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

  const connectedCount = connectedIds.size

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-base)' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, minWidth: 220,
        background: window.electronAPI ? 'transparent' : 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', padding: '18px 0', flexShrink: 0,
        WebkitAppRegion: 'drag',
      }}>
        <div style={{
          padding: '0 18px 24px', display: 'flex', alignItems: 'center', gap: 9,
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

        <nav style={{ padding: '0 10px', flex: 1, WebkitAppRegion: 'no-drag' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', padding: '0 8px', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>工作台</div>
          {[
            { icon: <LayoutDashboard size={15} />, label: '概览', path: '/' },
            { icon: <FolderOpen size={15} />, label: '项目空间', path: '/' },
            { icon: <MessageSquare size={15} />, label: '对话', path: '/' },
            { icon: <Sparkles size={15} />, label: '技能', path: '/skills' },
            { icon: <Plug size={15} />, label: 'MCP 工具', path: '/mcp', active: true },
          ].map(item => (
            <div key={item.label} onClick={() => navigate(item.path)} style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '7px 8px', borderRadius: 7, cursor: 'pointer',
              background: item.active ? 'var(--accent-glow)' : 'transparent',
              color: item.active ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: 13, fontWeight: item.active ? 600 : 400, transition: 'all 0.15s', marginBottom: 2,
            }}
            onMouseEnter={e => { if (!item.active) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)' } }}
            onMouseLeave={e => { if (!item.active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' } }}
            >
              <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
            </div>
          ))}
        </nav>

        {connectedCount > 0 && (
          <div style={{
            margin: '0 10px 8px', padding: '10px 12px', borderRadius: 10,
            background: 'var(--accent-glow)', border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', marginBottom: 4 }}>
              {connectedCount} 个工具已连接
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {getConnectedServers().map(s => s.name).join('、')}
            </div>
          </div>
        )}

        <div style={{ padding: '10px 10px 0', borderTop: '1px solid var(--border)', WebkitAppRegion: 'no-drag' }}>
          <div
            onClick={() => setShowSettings(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, var(--accent), var(--teal))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white', border: '1px solid var(--accent-border)' }}>
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
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>MCP 工具市场</h1>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>连接外部工具，让 AI 真正帮你执行任务</p>
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
              placeholder="搜索 MCP 工具…"
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
            可用工具 · {servers.length}
          </h2>
          {servers.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              未找到匹配的工具
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
              自治域模板
            </h2>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            预配置的 AI 智能体，一键安装所需技能和工具并创建专属项目。
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

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      {/* API Key 配置弹窗 */}
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
              {keyModal.server.icon} 配置 {keyModal.server.name}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: 1.65 }}>
              {keyModal.server.keyOptional
                ? 'API Key 可选。不填也可以直接连接，但会受到速率限制（每小时 60 次请求）。填写后获得更高配额，Key 仅存储在本地设备。'
                : '需要 API Key 才能获取真实数据。Key 仅保存在你的本地设备，不会上传到任何服务器。'
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
                placeholder={keyModal.server.keyOptional ? '粘贴 Token（可跳过）…' : '粘贴你的 API Key…'}
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 9, fontSize: 13,
                  background: 'var(--bg-input)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--mono)',
                  boxSizing: 'border-box',
                }}
              />
              {keyModal.server.id === 'brave-search' && (
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '8px 0 0', lineHeight: 1.5 }}>
                  没有 Key？访问{' '}
                  <a href="https://brave.com/search/api/" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
                    brave.com/search/api
                  </a>
                  {' '}免费注册，每月 2000 次免费查询。
                </p>
              )}
              {keyModal.server.id === 'github' && (
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '8px 0 0', lineHeight: 1.5 }}>
                  在 GitHub → Settings → Developer settings → Personal access tokens 生成，选 read-only 权限即可。
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
              <button onClick={() => setKeyModal(null)} style={{
                padding: '7px 16px', borderRadius: 8, fontSize: 12,
                background: 'var(--bg-hover)', border: '1px solid var(--border)',
                color: 'var(--text-secondary)', cursor: 'pointer',
              }}>取消</button>
              {keyModal.server.keyOptional && (
                <button onClick={handleKeySkip} style={{
                  padding: '7px 16px', borderRadius: 8, fontSize: 12,
                  background: 'var(--bg-hover)', border: '1px solid var(--border)',
                  color: 'var(--text-secondary)', cursor: 'pointer',
                }}>跳过，直接连接</button>
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
              >保存并连接</button>
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
              {showGuide.icon} 本地工具 · {showGuide.name}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: 1.65 }}>
              这类工具需要在你的电脑后台运行对应服务才能使用。
              <strong style={{ color: 'var(--text-secondary)' }}> ContextOS 正在开发内置支持</strong>，
              届时无需任何配置即可直接使用。
            </p>
            <div style={{
              background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
              borderRadius: 10, padding: '12px 16px', marginBottom: 20,
              fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6,
            }}>
              <div style={{ fontWeight: 600, color: 'var(--amber)', marginBottom: 4 }}>即将支持</div>
              下一版本将支持在 ContextOS 内直接一键启动本地工具，无需手动安装或配置。
              你可以关注版本更新，或点击下方「查看文档」了解此工具的功能。
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
                <ExternalLink size={11} /> 查看文档
              </a>
              <button onClick={() => setShowGuide(null)} style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 12,
                background: 'var(--bg-hover)', border: '1px solid var(--border)',
                color: 'var(--text-secondary)', cursor: 'pointer',
              }}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MCPCard({ server, connected, onConnect, onDisconnect, onShowGuide }) {
  const isHTTP = server.type === 'http'
  const needsKey = !!server.keyStore
  const hasKey = needsKey && !!localStorage.getItem(server.keyStore)

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
                background: 'rgba(139,92,246,0.08)', color: 'var(--accent)',
                border: '1px solid rgba(139,92,246,0.2)',
              }}>{server.keyOptional ? '可选 Token' : '需要 API Key'}</span>
            )}
            {connected && (
              <CheckCircle size={13} color="var(--accent)" style={{ marginLeft: 'auto' }} />
            )}
          </div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{server.desc}</p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-muted)' }}>
        <span>{server.tools} 个工具</span>
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
              {connected ? '✓ 已连接' : (needsKey && !hasKey && !server.keyOptional ? '配置 Key' : '连接')}
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
              查看详情
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function AgentTemplateCard({ template, deploying, onDeploy }) {
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
        <div>🔧 工具：{template.mcpServerIds.map(id => DEMO_SERVERS.find(s => s.id === id)?.name || id).join('、')}</div>
        <div>✨ 技能：{template.skillIds.map(id => BUILTIN_SKILLS.find(s => s.id === id)?.name || id).join('、')}</div>
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
          <><Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> 部署中…</>
        ) : (
          '一键部署'
        )}
      </button>
    </div>
  )
}
