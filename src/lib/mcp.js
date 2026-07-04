const CONNECTED_KEY = 'ctx_mcp_connected'

// 仅包含真实可用的 HTTP 工具（stdio 工具、纯演示工具已移除）
export const DEMO_SERVERS = [
  { id: 'brave-search', name: 'Brave Search', icon: '🔍', desc: '接入 Brave 搜索引擎，让 AI 实时获取网络信息', type: 'http', tools: 2, stars: 1840, category: '搜索', keyStore: 'ctx_brave_key', keyLabel: 'Brave Search API Key', permissions: ['实时网页搜索', '读取搜索结果摘要'] },
  { id: 'github',       name: 'GitHub',        icon: '🐙', desc: '访问 GitHub 公共 API，搜索代码仓库、读取文件内容', type: 'http', tools: 2, stars: 3200, category: '开发', keyStore: 'ctx_github_token', keyLabel: 'GitHub Token（可选）', keyOptional: true, permissions: ['搜索公共仓库', '读取仓库文件内容'] },
]

// Tool definitions per server — _execute is stripped before sending to Claude API
const SERVER_TOOLS = {
  'brave-search': [
    {
      name: 'web_search',
      description: '使用 Brave 搜索引擎搜索网页，获取实时信息',
      risk: 'read',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '搜索关键词' },
          count: { type: 'number', description: '返回结果数量（1-10），默认 5' },
        },
        required: ['query'],
      },
      _execute: async ({ query, count = 5 }) => {
        const apiKey = localStorage.getItem('ctx_brave_key')
        if (apiKey) {
          try {
            const r = await fetch(
              `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`,
              { headers: { Accept: 'application/json', 'X-Subscription-Token': apiKey } },
            )
            if (r.ok) {
              const d = await r.json()
              const results = d.web?.results || []
              if (results.length) {
                return results.map(x => `**${x.title}**\n${x.url}\n${x.description || ''}`).join('\n\n')
              }
            }
          } catch { /* fall back to demo search results */ }
        }
        return `[演示模式] 搜索"${query}"的模拟结果\n（在设置中添加 Brave Search API Key 可获取真实结果）\n\n1. 示例结果 A — https://example.com\n   相关内容摘要示例。\n2. 示例结果 B — https://example.org\n   更多相关信息。`
      },
    },
  ],

  'github': [
    {
      name: 'search_repositories',
      description: '搜索 GitHub 上的开源仓库',
      risk: 'read',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '搜索关键词，例如：react state management' },
          language: { type: 'string', description: '编程语言筛选（可选），例如：javascript' },
        },
        required: ['query'],
      },
      _execute: async ({ query, language }) => {
        const q = language ? `${query} language:${language}` : query
        const token = localStorage.getItem('ctx_github_token')
        const headers = {
          Accept: 'application/vnd.github.v3+json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        }
        try {
          const r = await fetch(
            `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&per_page=5`,
            { headers },
          )
          if (r.ok) {
            const d = await r.json()
            const items = d.items || []
            if (items.length) {
              const results = items
                .map(x => `**${x.full_name}** ★${x.stargazers_count.toLocaleString()}\n${x.description || '暂无描述'}\n${x.html_url}`)
                .join('\n\n')
              return token ? results : results + '\n\n---\n提示：配置 GitHub Token 可解除 60次/小时 的速率限制。'
            }
          } else if (r.status === 403) {
            return '已触发 GitHub API 速率限制（60次/小时），请在 MCP 工具设置中配置 GitHub Token 以解除限制。'
          }
        } catch { /* fall through to generic GitHub search failure */ }
        return '未能获取 GitHub 搜索结果'
      },
    },
    {
      name: 'get_file_contents',
      description: '读取 GitHub 仓库中某个文件的内容',
      risk: 'read',
      input_schema: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: '仓库所有者，例如：facebook' },
          repo:  { type: 'string', description: '仓库名称，例如：react' },
          path:  { type: 'string', description: '文件路径，例如：README.md' },
        },
        required: ['owner', 'repo', 'path'],
      },
      _execute: async ({ owner, repo, path }) => {
        const token = localStorage.getItem('ctx_github_token')
        const headers = {
          Accept: 'application/vnd.github.v3+json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        }
        try {
          const r = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
            { headers },
          )
          if (r.ok) {
            const d = await r.json()
            if (d.content) {
              const content = atob(d.content.replace(/\n/g, ''))
              return content.length > 3000 ? content.slice(0, 3000) + '\n\n…（内容已截断）' : content
            }
          } else if (r.status === 403) {
            return '已触发 GitHub API 速率限制，请配置 GitHub Token。'
          }
        } catch { /* fall through to generic file fetch failure */ }
        return '获取文件失败'
      },
    },
  ],
}

// --- Connected servers (localStorage) ---

export function getConnectedServers() {
  try {
    return JSON.parse(localStorage.getItem(CONNECTED_KEY) || '[]')
  } catch {
    return []
  }
}

export function saveConnectedServer(server) {
  const list = getConnectedServers()
  if (!list.find(s => s.id === server.id)) {
    localStorage.setItem(CONNECTED_KEY, JSON.stringify([...list, server]))
  }
}

export function removeConnectedServer(id) {
  localStorage.setItem(CONNECTED_KEY, JSON.stringify(getConnectedServers().filter(s => s.id !== id)))
}

// --- Custom MCP server: real Streamable HTTP (JSON-RPC 2.0) client ---
//
// Implements the current MCP Streamable HTTP transport: a single endpoint that
// accepts POSTed JSON-RPC messages and replies with either application/json or
// an SSE (text/event-stream) frame. Works against real MCP servers — in Electron
// there is no CORS restriction; in a browser the server must send CORS headers.

const MCP_PROTOCOL_VERSION = '2025-06-18'

// One JSON-RPC round trip. Returns { result, sessionId }.
async function mcpRpc(url, method, params, { sessionId, apiKey, isNotification } = {}) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {}),
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
  }
  const payload = { jsonrpc: '2.0', method, params: params || {} }
  if (!isNotification) payload.id = Date.now()
  const res = await fetch(url, {
    method: 'POST', headers, body: JSON.stringify(payload),
    signal: AbortSignal.timeout(12000),
  })
  const nextSession = res.headers.get('mcp-session-id') || sessionId
  if (isNotification) return { result: null, sessionId: nextSession }
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const ct = res.headers.get('content-type') || ''
  let json
  if (ct.includes('text/event-stream')) {
    const text = await res.text()
    const dataLines = text.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).filter(Boolean)
    if (!dataLines.length) throw new Error('空的 SSE 响应')
    json = JSON.parse(dataLines[dataLines.length - 1])
  } else {
    json = await res.json()
  }
  if (json.error) throw new Error(json.error.message || `JSON-RPC error ${json.error.code}`)
  return { result: json.result, sessionId: nextSession }
}

// Open a session: initialize + initialized notification. Returns sessionId.
async function mcpHandshake(url, apiKey) {
  const init = await mcpRpc(url, 'initialize', {
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: 'ContextOS', version: '1.0' },
  }, { apiKey })
  const sessionId = init.sessionId
  try {
    await mcpRpc(url, 'notifications/initialized', {}, { sessionId, apiKey, isNotification: true })
  } catch { /* notification failures are non-fatal */ }
  return sessionId
}

// Heuristic risk level from a tool name (custom servers don't declare risk).
function inferRisk(name) {
  const n = (name || '').toLowerCase()
  if (/(delete|remove|drop|destroy|truncate|exec|run|send|move|rename)/.test(n)) return 'high'
  if (/(create|update|insert|write|post|put|set|add|modify|patch|upload)/.test(n)) return 'write'
  return 'read'
}

// Connect a custom server: handshake + tools/list. Returns a server object
// (with discoveredTools) ready to persist, or throws with a readable message.
export async function connectCustomServer({ name, url, apiKey }) {
  if (!/^https:\/\//i.test(url)) throw new Error('URL 必须以 https:// 开头')
  const sessionId = await mcpHandshake(url, apiKey)
  const listed = await mcpRpc(url, 'tools/list', {}, { sessionId, apiKey })
  const rawTools = listed.result?.tools || []
  if (!rawTools.length) throw new Error('该服务未暴露任何工具')
  const discoveredTools = rawTools.map(t => ({
    name: t.name,
    description: t.description || '',
    input_schema: t.inputSchema || t.input_schema || { type: 'object', properties: {} },
    risk: inferRisk(t.name),
  }))
  const id = `custom-${crypto.randomUUID().slice(0, 8)}`
  const keyStore = apiKey ? `ctx_mcp_${id}_key` : undefined
  if (keyStore) localStorage.setItem(keyStore, apiKey)
  return {
    id, name: name || url, icon: '🔌', desc: url, type: 'http',
    category: '自定义', custom: true, url, keyStore,
    tools: discoveredTools.length, stars: 0,
    discoveredTools,
  }
}

// Tool defs for a server, whether curated (SERVER_TOOLS) or custom (discovered).
function serverToolDefs(server) {
  if (server?.custom) return server.discoveredTools || []
  return SERVER_TOOLS[server?.id] || []
}

// --- Per-tool enable/disable (localStorage) ---

const DISABLED_TOOLS_KEY = 'ctx_mcp_disabled_tools'
const ALLOW_RISKY_TOOLS_KEY = 'ctx_mcp_allow_risky_tools'

function toolKey(serverId, toolName) {
  return `${serverId}:${toolName}`
}

export function getDisabledTools() {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISABLED_TOOLS_KEY) || '[]'))
  } catch {
    return new Set()
  }
}

export function isToolEnabled(serverId, toolName) {
  return !getDisabledTools().has(toolKey(serverId, toolName))
}

export function setToolEnabled(serverId, toolName, enabled) {
  const disabled = getDisabledTools()
  if (enabled) disabled.delete(toolKey(serverId, toolName))
  else disabled.add(toolKey(serverId, toolName))
  localStorage.setItem(DISABLED_TOOLS_KEY, JSON.stringify([...disabled]))
}

export function getAllowRiskyTools() {
  return localStorage.getItem(ALLOW_RISKY_TOOLS_KEY) === 'true'
}

export function setAllowRiskyTools(allowed) {
  localStorage.setItem(ALLOW_RISKY_TOOLS_KEY, allowed ? 'true' : 'false')
}

// Public tool metadata for UI display (no _execute). Works for curated and
// custom servers; pass the server object for custom servers, else just the id.
export function getServerToolDefs(serverOrId) {
  const server = typeof serverOrId === 'string'
    ? (getConnectedServers().find(s => s.id === serverOrId) || { id: serverOrId })
    : serverOrId
  return serverToolDefs(server).map(d => ({
    name: d.name,
    description: d.description,
    risk: d.risk || 'read',
  }))
}

// --- Skill ↔ MCP dependency linking ---

// For a skill's mcpDeps (array of server ids), report connection status.
// Returns [{ id, name, connected }]; empty array when no deps.
export function getMcpDependencyStatus(deps = []) {
  if (!deps || !deps.length) return []
  const connectedIds = new Set(getConnectedServers().map(s => s.id))
  return deps.map(id => {
    const server = DEMO_SERVERS.find(s => s.id === id)
    return { id, name: server?.name || id, connected: connectedIds.has(id) }
  })
}

// --- Tool schema helpers ---

export function getAllServerTools(connectedServers) {
  const disabled = getDisabledTools()
  const tools = []
  for (const server of connectedServers) {
    for (const def of serverToolDefs(server)) {
      if (disabled.has(toolKey(server.id, def.name))) continue // user-disabled tool: hide from AI
      tools.push({
        name: def.name,
        description: def.description,
        input_schema: def.input_schema,
        risk: def.risk || 'read',
        _serverId: server.id,
        _serverName: server.name,
      })
    }
  }
  return tools
}

export async function executeTool(serverId, toolName, toolInput) {
  if (!isToolEnabled(serverId, toolName)) return `工具 ${toolName} 已被用户禁用`

  // Custom server: real MCP call over HTTP (fresh session per call)
  const custom = getConnectedServers().find(s => s.id === serverId && s.custom)
  if (custom) {
    try {
      const apiKey = custom.keyStore ? localStorage.getItem(custom.keyStore) : null
      const sessionId = await mcpHandshake(custom.url, apiKey)
      const { result } = await mcpRpc(custom.url, 'tools/call', { name: toolName, arguments: toolInput }, { sessionId, apiKey })
      const texts = (result?.content || []).filter(c => c.type === 'text').map(c => c.text)
      return texts.join('\n') || JSON.stringify(result)
    } catch (e) {
      return `自定义工具执行出错：${e.message}`
    }
  }

  const defs = SERVER_TOOLS[serverId] || []
  const def = defs.find(d => d.name === toolName)
  if (!def?._execute) return `未找到工具 ${toolName}`
  try {
    return await def._execute(toolInput)
  } catch (e) {
    return `工具执行出错：${e.message}`
  }
}

// --- Glama API search (with demo fallback) ---

function normalizeMCPServer(raw) {
  return {
    id: raw.id || raw.slug || (raw.name || '').toLowerCase().replace(/\s+/g, '-'),
    name: raw.name || raw.title || 'Unknown',
    icon: raw.icon || '🔧',
    desc: raw.description || raw.desc || '',
    type: raw.type === 'stdio' ? 'stdio' : 'http',
    tools: raw.toolCount ?? (Array.isArray(raw.tools) ? raw.tools.length : (raw.tools || 0)),
    stars: raw.stargazers || raw.stars || raw.stargazersCount || 0,
    category: raw.category || '全部',
  }
}

export async function searchMCPServers(query = '', category = '全部', limit = 20) {
  // Always pin our curated real tools at the top
  const curatedFiltered = DEMO_SERVERS.filter(s => {
    const matchCat = category === '全部' || s.category === category
    const matchQ = !query || s.name.toLowerCase().includes(query.toLowerCase()) || s.desc.includes(query)
    return matchCat && matchQ
  })

  try {
    const params = new URLSearchParams({ limit: String(limit) })
    if (query) params.set('q', query)
    const GLAMA_BASE = window.electronAPI ? 'https://glama.ai' : '/api-glama'
    const r = await fetch(`${GLAMA_BASE}/api/mcp/servers?${params}`, {
      signal: AbortSignal.timeout(4000),
    })
    if (r.ok) {
      const data = await r.json()
      let glamaServers = (data.servers || data.items || (Array.isArray(data) ? data : [])).map(normalizeMCPServer)
      if (category !== '全部') glamaServers = glamaServers.filter(s => s.category === category)
      // Merge: curated first, then Glama results (excluding curated IDs to avoid duplicates)
      const curatedIds = new Set(DEMO_SERVERS.map(s => s.id))
      const extra = glamaServers.filter(s => !curatedIds.has(s.id))
      const merged = [...curatedFiltered, ...extra].slice(0, limit)
      if (merged.length > 0) return { servers: merged, isDemo: false }
    }
  } catch { /* keep curated tools when Glama is unavailable */ }

  // Glama unavailable — silently show curated tools only
  return { servers: curatedFiltered, isDemo: false }
}
