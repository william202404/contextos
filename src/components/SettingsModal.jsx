import { useState, useEffect } from 'react'
import { Palette, User, Zap, Wrench, Sun, Moon, Monitor } from 'lucide-react'
import { getApiKeys, saveApiKeys, getOllamaBaseUrl, saveOllamaBaseUrl, getOllamaModels, getCompatibleConfig, saveCompatibleConfig } from '../lib/llm'
import { getSkillHubKey, saveSkillHubKey, getSkillHubUrl, saveSkillHubUrl, testSkillHubConnection } from '../lib/skillhub'

const COMPAT_PRESETS = [
  { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1' },
  { label: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1' },
  { label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1' },
]

const SECTIONS = [
  { id: 'appearance', label: '外观', icon: <Palette size={15} /> },
  { id: 'personal',   label: '个人信息', icon: <User size={15} /> },
  { id: 'models',     label: 'AI 模型', icon: <Zap size={15} /> },
  { id: 'tools',      label: '工具集成', icon: <Wrench size={15} /> },
]

export function getUserProfile() {
  return {
    name: localStorage.getItem('ctx_user_name') || '',
    role: localStorage.getItem('ctx_user_role') || '',
  }
}

export function saveUserProfile({ name, role }) {
  if (name !== undefined) localStorage.setItem('ctx_user_name', name)
  if (role !== undefined) localStorage.setItem('ctx_user_role', role)
}

export function getTheme() {
  return localStorage.getItem('ctx_theme') || 'system'
}

export function applyTheme(theme) {
  localStorage.setItem('ctx_theme', theme)
  const html = document.documentElement
  html.classList.remove('theme-dark', 'theme-light')
  if (theme === 'dark') html.classList.add('theme-dark')
  else if (theme === 'light') html.classList.add('theme-light')
}

export default function SettingsModal({ onClose }) {
  const [activeSection, setActiveSection] = useState('appearance')
  const [theme, setTheme] = useState(getTheme())
  const [keys, setKeys] = useState({ claude: '', openai: '' })
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434')
  const [ollamaStatus, setOllamaStatus] = useState(null)
  const [profile, setProfile] = useState({ name: '', role: '' })
  const [braveKey, setBraveKey] = useState('')
  const [skillhubKey, setSkillhubKey] = useState('')
  const [skillhubUrl, setSkillhubUrl] = useState('')
  const [skillhubStatus, setSkillhubStatus] = useState(null)
  const [skillhubMsg, setSkillhubMsg] = useState('')
  const [showSkillhubUrl, setShowSkillhubUrl] = useState(false)
  const [compatConfig, setCompatConfig] = useState({ key: '', baseUrl: '', models: '', label: '兼容接口' })

  useEffect(() => {
    setKeys(getApiKeys())
    setOllamaUrl(getOllamaBaseUrl())
    setProfile(getUserProfile())
    setBraveKey(localStorage.getItem('ctx_brave_key') || '')
    setSkillhubKey(getSkillHubKey())
    setSkillhubUrl(getSkillHubUrl())
    setCompatConfig(getCompatibleConfig())
  }, [])

  function handleThemeChange(t) {
    setTheme(t)
    applyTheme(t)
  }

  async function handleCheckOllama() {
    setOllamaStatus('checking')
    saveOllamaBaseUrl(ollamaUrl)
    const models = await getOllamaModels()
    const names = Object.keys(models)
    setOllamaStatus(names.length > 0 ? names : 'none')
  }

  async function handleTestSkillHub() {
    if (!skillhubKey.trim()) return
    setSkillhubStatus('checking')
    setSkillhubMsg('')
    try {
      const data = await testSkillHubConnection(skillhubKey.trim(), skillhubUrl.trim())
      const count = Array.isArray(data) ? data.length : (data?.skills?.length || data?.total || '?')
      setSkillhubStatus('ok')
      setSkillhubMsg(`连接成功，发现 ${count} 个技能`)
    } catch (e) {
      if (e.message === 'CORS_OR_NETWORK') {
        setSkillhubStatus('cors')
        setSkillhubMsg('')
      } else if (e.message?.startsWith('HTTP_')) {
        const code = e.message.replace('HTTP_', '')
        setSkillhubStatus('error')
        setSkillhubMsg(`服务器返回 ${code}${code === '401' ? '：API Key 无效' : code === '404' ? '：接口地址不对' : ''}`)
      } else {
        setSkillhubStatus('error')
        setSkillhubMsg(e.message || '连接失败')
      }
    }
  }

  function handleSave() {
    saveApiKeys(keys)
    saveOllamaBaseUrl(ollamaUrl)
    saveUserProfile(profile)
    localStorage.setItem('ctx_brave_key', braveKey.trim())
    if (skillhubKey !== getSkillHubKey()) saveSkillHubKey(skillhubKey)
    if (skillhubUrl !== getSkillHubUrl()) saveSkillHubUrl(skillhubUrl)
    saveCompatibleConfig(compatConfig)
    onClose()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 20, width: 700, maxWidth: '92vw', maxHeight: '88vh',
        display: 'flex', overflow: 'hidden',
        boxShadow: 'var(--shadow-lg)',
      }}>
        {/* Left nav */}
        <div style={{
          width: 168, flexShrink: 0,
          background: 'var(--bg-card)',
          borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          padding: '22px 0',
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', padding: '0 18px 20px', letterSpacing: '-0.01em' }}>
            设置
          </div>
          {SECTIONS.map(s => (
            <div
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '8px 12px', margin: '0 8px 2px', borderRadius: 8,
                cursor: 'pointer', fontSize: 13,
                fontWeight: activeSection === s.id ? 600 : 400,
                color: activeSection === s.id ? 'var(--accent)' : 'var(--text-secondary)',
                background: activeSection === s.id ? 'var(--accent-glow)' : 'transparent',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (activeSection !== s.id) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)' } }}
              onMouseLeave={e => { if (activeSection !== s.id) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' } }}
            >
              <span style={{ display: 'flex', alignItems: 'center', color: 'inherit' }}>{s.icon}</span>
              {s.label}
            </div>
          ))}
        </div>

        {/* Right content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Content area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                {SECTIONS.find(s => s.id === activeSection)?.label}
              </h3>
              <button onClick={onClose} style={closeBtnStyle}>✕</button>
            </div>

            {/* ── 外观 ── */}
            {activeSection === 'appearance' && (
              <div>
                <Label>主题</Label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
                  {[
                    { id: 'system', label: '跟随系统', icon: <Monitor size={22} />, desc: '跟随 OS 设置' },
                    { id: 'dark',   label: '深色',   icon: <Moon size={22} />,    desc: '护眼暗色模式' },
                    { id: 'light',  label: '浅色',   icon: <Sun size={22} />,     desc: '明亮清爽模式' },
                  ].map(t => {
                    const sel = theme === t.id
                    return (
                      <div
                        key={t.id}
                        onClick={() => handleThemeChange(t.id)}
                        style={{
                          padding: '18px 12px 14px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
                          border: `1.5px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
                          background: sel ? 'var(--accent-glow)' : 'var(--bg-card)',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { if (!sel) e.currentTarget.style.background = 'var(--bg-hover)' }}
                        onMouseLeave={e => { if (!sel) e.currentTarget.style.background = 'var(--bg-card)' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8, color: sel ? 'var(--accent)' : 'var(--text-muted)' }}>{t.icon}</div>
                        <div style={{ fontSize: 13, fontWeight: sel ? 700 : 500, color: sel ? 'var(--accent)' : 'var(--text-primary)', marginBottom: 3 }}>{t.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.desc}</div>
                      </div>
                    )
                  })}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  更改即时生效，无需保存。
                </div>
              </div>
            )}

            {/* ── 个人信息 ── */}
            {activeSection === 'personal' && (
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                  用于界面显示，仅保存在本地。
                </div>
                <FieldRow label="昵称">
                  <Input value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} placeholder="你的名字" />
                </FieldRow>
                <FieldRow label="身份 / 职业">
                  <Input value={profile.role} onChange={e => setProfile(p => ({ ...p, role: e.target.value }))} placeholder="例如：学生、设计师、产品经理…" />
                </FieldRow>
              </div>
            )}

            {/* ── AI 模型 ── */}
            {activeSection === 'models' && (
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                  API Key 仅存储在本地浏览器，不经过任何服务器。
                </div>

                <Label>云端模型</Label>
                <FieldRow label="Claude API Key">
                  <Input type="password" value={keys.claude} onChange={e => setKeys(k => ({ ...k, claude: e.target.value }))} placeholder="sk-ant-…" />
                </FieldRow>
                <FieldRow label="OpenAI API Key">
                  <Input type="password" value={keys.openai} onChange={e => setKeys(k => ({ ...k, openai: e.target.value }))} placeholder="sk-…" />
                </FieldRow>

                {/* Compatible API */}
                <div style={{ margin: '16px 0 0', padding: '14px 16px', borderRadius: 12, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                    兼容接口（OpenAI 格式）
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.6 }}>
                    支持 OpenRouter、通义千问、DeepSeek 等 OpenAI 兼容服务
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {COMPAT_PRESETS.map(p => {
                      const active = compatConfig.label === p.label && compatConfig.baseUrl === p.baseUrl
                      return (
                        <button key={p.label} onClick={() => setCompatConfig(c => ({ ...c, label: p.label, baseUrl: p.baseUrl }))} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent-glow)' : 'var(--bg-hover)', color: active ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: 500, transition: 'all 0.15s' }}>{p.label}</button>
                      )
                    })}
                  </div>
                  <FieldRow label="Base URL">
                    <Input value={compatConfig.baseUrl} onChange={e => setCompatConfig(c => ({ ...c, baseUrl: e.target.value }))} placeholder="https://openrouter.ai/api/v1" />
                  </FieldRow>
                  <FieldRow label="API Key">
                    <Input type="password" value={compatConfig.key} onChange={e => setCompatConfig(c => ({ ...c, key: e.target.value }))} placeholder="填入该服务的 API Key" />
                  </FieldRow>
                  <FieldRow label="模型列表（逗号分隔）" noMargin>
                    <Input value={compatConfig.models} onChange={e => setCompatConfig(c => ({ ...c, models: e.target.value }))} placeholder="gpt-4o,claude-3-5-sonnet" mono />
                  </FieldRow>
                </div>

                {/* Ollama */}
                <div style={{ marginTop: 20 }}>
                  <Label>本地模型 · Ollama</Label>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
                    本地运行的开源模型，无需 API Key，完全离线可用。
                  </div>
                  <FieldRow label="Ollama 地址">
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Input value={ollamaUrl} onChange={e => setOllamaUrl(e.target.value)} placeholder="http://localhost:11434" style={{ flex: 1 }} />
                      <button onClick={handleCheckOllama} disabled={ollamaStatus === 'checking'} style={checkBtnStyle}>
                        {ollamaStatus === 'checking' ? '检测中…' : '检测连接'}
                      </button>
                    </div>
                  </FieldRow>
                  {ollamaStatus && ollamaStatus !== 'checking' && (
                    <StatusBanner
                      ok={Array.isArray(ollamaStatus)}
                      msg={ollamaStatus === 'none'
                        ? '未检测到可用的对话模型，请确认 Ollama 正在运行且已安装模型。'
                        : `已发现 ${ollamaStatus.length} 个模型：${ollamaStatus.join('、')}`}
                    />
                  )}
                </div>
              </div>
            )}

            {/* ── 工具集成 ── */}
            {activeSection === 'tools' && (
              <div>
                <Label>搜索 · Brave Search</Label>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 }}>
                  用于 MCP 工具中的实时网络搜索。
                  <a href="https://api.search.brave.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', marginLeft: 4 }}>免费申请 →</a>
                </div>
                <FieldRow label="Brave Search API Key">
                  <Input type="password" value={braveKey} onChange={e => setBraveKey(e.target.value)} placeholder="BSA…" />
                </FieldRow>
                {braveKey.trim() && (
                  <div style={{ marginTop: -4, marginBottom: 8, fontSize: 11, color: 'var(--accent)', fontWeight: 500 }}>✓ 已配置，保存后生效</div>
                )}

                <div style={{ height: 1, background: 'var(--border)', margin: '20px 0' }} />

                <Label>技能市场 · SkillHub</Label>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 }}>
                  无需 Key 即可免费使用公开技能；企业 Key 用于访问私有技能库。
                </div>
                <FieldRow label="企业 API Key（可选）">
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Input type="password" value={skillhubKey} onChange={e => { setSkillhubKey(e.target.value); setSkillhubStatus(null) }} placeholder="sk-ent-…" style={{ flex: 1 }} />
                    <button onClick={handleTestSkillHub} disabled={!skillhubKey.trim() || skillhubStatus === 'checking'} style={checkBtnStyle}>
                      {skillhubStatus === 'checking' ? '测试中…' : '测试连接'}
                    </button>
                  </div>
                </FieldRow>

                {skillhubStatus === 'cors' && (
                  <div style={{ marginTop: 8, padding: '12px 14px', borderRadius: 10, background: 'var(--amber-bg)', border: '1px solid var(--amber-border)', fontSize: 12, color: '#92400e', lineHeight: 1.7 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>⚠ 浏览器跨域限制（CORS）</div>
                    <div>直接从浏览器请求 SkillHub 被服务端拒绝，请确认 API 地址正确或在本地起代理。</div>
                    <button onClick={() => setShowSkillhubUrl(v => !v)} style={{ marginTop: 8, fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                      {showSkillhubUrl ? '收起' : '修改 API 地址'}
                    </button>
                  </div>
                )}
                {skillhubStatus && skillhubStatus !== 'checking' && skillhubStatus !== 'cors' && (
                  <StatusBanner ok={skillhubStatus === 'ok'} msg={skillhubMsg} />
                )}
                {(showSkillhubUrl || skillhubStatus === 'cors') && (
                  <div style={{ marginTop: 10 }}>
                    <FieldRow label="API 地址（高级）">
                      <Input value={skillhubUrl} onChange={e => { setSkillhubUrl(e.target.value); setSkillhubStatus(null) }} placeholder="https://api.skillhub.cn/api/v1/registry/verify" />
                    </FieldRow>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '14px 28px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0, background: 'var(--bg-surface)' }}>
            <button onClick={onClose} style={cancelBtnStyle}>取消</button>
            <button onClick={handleSave} style={saveBtnStyle}>保存</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusBanner({ ok, msg }) {
  return (
    <div style={{
      marginTop: 8, marginBottom: 4, padding: '10px 12px', borderRadius: 8,
      background: ok ? 'var(--green-bg)' : 'var(--red-bg)',
      border: `1px solid ${ok ? 'var(--green-border)' : 'var(--red-border)'}`,
      fontSize: 12, color: ok ? 'var(--green)' : 'var(--red)', fontWeight: ok ? 600 : 400,
    }}>
      {msg}
    </div>
  )
}

function Label({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>
      {children}
    </div>
  )
}

function FieldRow({ label, children, noMargin }) {
  return (
    <div style={{ marginBottom: noMargin ? 0 : 12 }}>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text', mono, style: extra }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        width: '100%', padding: '9px 12px', borderRadius: 10,
        border: '1px solid var(--border)', background: 'var(--bg-input)',
        color: 'var(--text-primary)', fontSize: mono ? 11 : 13,
        fontFamily: mono ? 'var(--font-mono)' : 'inherit',
        outline: 'none', transition: 'border-color 0.15s', boxSizing: 'border-box',
        ...extra,
      }}
      onFocus={e => e.target.style.borderColor = 'var(--accent-light)'}
      onBlur={e => e.target.style.borderColor = 'var(--border)'}
    />
  )
}

const closeBtnStyle = {
  background: 'transparent', border: 'none', color: 'var(--text-muted)',
  fontSize: 16, cursor: 'pointer', padding: 4, borderRadius: 6,
}
const cancelBtnStyle = {
  padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 500,
  cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent',
  color: 'var(--text-secondary)',
}
const saveBtnStyle = {
  padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
  cursor: 'pointer', border: 'none', background: 'var(--accent)', color: 'white',
}
const checkBtnStyle = {
  padding: '9px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600,
  cursor: 'pointer', border: '1px solid var(--border)',
  background: 'var(--bg-card)', color: 'var(--text-secondary)',
  whiteSpace: 'nowrap', flexShrink: 0,
}
