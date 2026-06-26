const CONNECTED_KEY = 'ctx_mcp_connected'

// 仅包含真实可用的 HTTP 工具（stdio 工具、纯演示工具已移除）
export const DEMO_SERVERS = [
  { id: 'brave-search', name: 'Brave Search', icon: '🔍', desc: '接入 Brave 搜索引擎，让 AI 实时获取网络信息', type: 'http', tools: 2, stars: 1840, category: '搜索', keyStore: 'ctx_brave_key', keyLabel: 'Brave Search API Key' },
  { id: 'github',       name: 'GitHub',        icon: '🐙', desc: '访问 GitHub 公共 API，搜索代码仓库、读取文件内容', type: 'http', tools: 2, stars: 3200, category: '开发', keyStore: 'ctx_github_token', keyLabel: 'GitHub Token（可选）', keyOptional: true },
]

// Tool definitions per server — _execute is stripped before sending to Claude API
const SERVER_TOOLS = {
  'brave-search': [
    {
      name: 'web_search',
      description: '使用 Brave 搜索引擎搜索网页，获取实时信息',
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
          } catch {}
        }
        return `[演示模式] 搜索"${query}"的模拟结果\n（在设置中添加 Brave Search API Key 可获取真实结果）\n\n1. 示例结果 A — https://example.com\n   相关内容摘要示例。\n2. 示例结果 B — https://example.org\n   更多相关信息。`
      },
    },
  ],

  'github': [
    {
      name: 'search_repositories',
      description: '搜索 GitHub 上的开源仓库',
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
        } catch {}
        return '未能获取 GitHub 搜索结果'
      },
    },
    {
      name: 'get_file_contents',
      description: '读取 GitHub 仓库中某个文件的内容',
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
        } catch {}
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

// --- Tool schema helpers ---

export function getAllServerTools(connectedServers) {
  const tools = []
  for (const server of connectedServers) {
    for (const def of SERVER_TOOLS[server.id] || []) {
      tools.push({
        name: def.name,
        description: def.description,
        input_schema: def.input_schema,
        _serverId: server.id,
      })
    }
  }
  return tools
}

export async function executeTool(serverId, toolName, toolInput) {
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
  } catch {}

  // Glama unavailable — silently show curated tools only
  return { servers: curatedFiltered, isDemo: false }
}
