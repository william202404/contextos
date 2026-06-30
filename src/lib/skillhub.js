// SkillHub (https://skillhub.cn) 集成
// Electron 环境：主进程通过 webRequest 注入 CORS 头，可直连
// Web 环境：Vite dev/preview 通过代理 /api-skillhub 转发

const IS_ELECTRON = typeof window !== 'undefined' && !!window.electronAPI
const PUBLIC_SEARCH_URL = IS_ELECTRON
  ? 'https://api.skillhub.cn/api/v1/search'
  : '/api-skillhub/search'
const ENTERPRISE_VERIFY_URL = 'https://api.skillhub.cn/api/v1/registry/verify'

export function getSkillHubKey() {
  return localStorage.getItem('ctx_skillhub_key') || ''
}

export function saveSkillHubKey(key) {
  localStorage.setItem('ctx_skillhub_key', key)
}

// 公开技能搜索 — 不需要 API Key
export async function searchSkillHub(query = '', limit = 30) {
  const params = new URLSearchParams({ q: query, limit: String(limit) })
  const res = await fetch(`${PUBLIC_SEARCH_URL}?${params}`, {
    headers: { 'Accept': 'application/json' },
  })
  if (!res.ok) throw new Error(`HTTP_${res.status}`)
  const data = await res.json()
  return data.results || []
}

// URL 配置（SettingsModal 兼容）
export function getSkillHubUrl() {
  return localStorage.getItem('ctx_skillhub_url') || '/api-skillhub/search'
}
export function saveSkillHubUrl(url) {
  localStorage.setItem('ctx_skillhub_url', url)
}

// 企业 API Key 验证
export async function testSkillHubConnection(apiKey) {
  return verifySkillHubKey(apiKey)
}

export async function verifySkillHubKey(apiKey) {
  const res = await fetch(ENTERPRISE_VERIFY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: '',
  })
  if (!res.ok) throw new Error(`HTTP_${res.status}`)
  return res.json() // { orgId, orgSlug, orgName, ... }
}

// 将 SkillHub 返回的技能格式转换为 ContextOS 内部格式
const CATEGORY_MAP = {
  'ai-intelligence': 'AI 智能',
  'developer-tools': '开发工具',
  'security-compliance': '安全合规',
  'productivity': '效率提升',
  'data-analytics': '数据分析',
  'communication': '沟通协作',
  'learning': '学习成长',
  'creative': '创意创作',
}

export function normalizeSkillHubSkill(s) {
  const category = CATEGORY_MAP[s.category] || s.category || '通用'
  // 把技能描述作为对话系统提示词（更适合作为 AI 角色指令）
  const desc = s.description_zh || s.description || ''
  return {
    id: `sh-${s.slug}`,
    slug: s.slug,
    name: s.displayName || s.name || s.slug,
    icon: '🔮',
    category,
    desc: desc.length > 80 ? desc.slice(0, 78) + '…' : desc,
    fullDesc: desc,
    color: '#2563eb',
    gradient: 'linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(59,130,246,0.04) 100%)',
    systemPrompt: desc,
    source: 'skillhub',
    stars: s.stars || 0,
    downloads: s.downloads || 0,
    author: s.author || s.owner || s.publisher || '社区作者',
    version: s.version || s.latestVersion || '',
    changelog: s.changelog || s.releaseNotes || '',
    requiresApiKey: s.labels?.requires_api_key === 'true',
    homepage: s.homepage || `https://skillhub.cn/${s.slug}`,
  }
}
