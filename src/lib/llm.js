export const MODELS = {
  'claude-sonnet-4-6': { label: 'Claude Sonnet 4.6', provider: 'claude', tag: 'Claude' },
  'claude-opus-4-8': { label: 'Claude Opus 4.8', provider: 'claude', tag: 'Claude' },
  'gpt-4o': { label: 'GPT-4o', provider: 'openai', tag: 'GPT' },
}

export const DEFAULT_MODEL = 'claude-sonnet-4-6'

export function getApiKeys() {
  return {
    claude: localStorage.getItem('ctx_claude_key') || '',
    openai: localStorage.getItem('ctx_openai_key') || '',
  }
}

export function saveApiKeys({ claude, openai }) {
  if (claude !== undefined) localStorage.setItem('ctx_claude_key', claude)
  if (openai !== undefined) localStorage.setItem('ctx_openai_key', openai)
}

export function getOllamaBaseUrl() {
  return localStorage.getItem('ctx_ollama_url') || 'http://localhost:11434'
}

export function saveOllamaBaseUrl(url) {
  localStorage.setItem('ctx_ollama_url', url)
}

export function getCompatibleConfig() {
  return {
    key:    localStorage.getItem('ctx_compat_key') || '',
    baseUrl:localStorage.getItem('ctx_compat_url') || '',
    models: localStorage.getItem('ctx_compat_models') || '',
    label:  localStorage.getItem('ctx_compat_label') || '兼容接口',
  }
}

export function saveCompatibleConfig({ key, baseUrl, models, label }) {
  if (key !== undefined) localStorage.setItem('ctx_compat_key', key)
  if (baseUrl !== undefined) localStorage.setItem('ctx_compat_url', baseUrl)
  if (models !== undefined) localStorage.setItem('ctx_compat_models', models)
  if (label !== undefined) localStorage.setItem('ctx_compat_label', label)
}

export function getCompatibleModels() {
  const { key, baseUrl, models, label } = getCompatibleConfig()
  if (!key || !baseUrl || !models) return {}
  const result = {}
  for (const m of models.split(',').map(s => s.trim()).filter(Boolean)) {
    result[m] = { label: m, provider: 'compatible', tag: label }
  }
  return result
}

export async function getOllamaModels() {
  const baseUrl = getOllamaBaseUrl()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 3000)
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) return {}
    const data = await res.json()
    const models = {}
    for (const m of data.models || []) {
      if (m.remote_host) continue
      // capabilities 字段仅新版 Ollama 有，没有该字段时默认当对话模型处理
      const caps = m.capabilities
      if (caps && !caps.includes('completion')) continue
      models[m.name] = { label: m.name, provider: 'ollama', tag: 'Ollama' }
    }
    return models
  } catch {
    clearTimeout(timer)
    return {}
  }
}

const CLAUDE_HEADERS = (apiKey) => ({
  'Content-Type': 'application/json',
  'x-api-key': apiKey,
  'anthropic-version': '2023-06-01',
  'anthropic-dangerous-direct-browser-access': 'true',
})

// Multi-turn tool calling (non-streaming per round, streaming for final response)
async function streamClaudeWithTools({ apiKey, model, conversationMessages, systemPrompt, tools, onChunk, onDone, onError, onToolStatus, onToolCall }) {
  const msgs = [...conversationMessages]
  const apiTools = tools.map(({ name, description, input_schema }) => ({ name, description, input_schema }))
  const MAX_ROUNDS = 5

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: CLAUDE_HEADERS(apiKey),
      body: JSON.stringify({
        model, max_tokens: 4096,
        ...(systemPrompt ? { system: systemPrompt } : {}),
        messages: msgs,
        tools: apiTools,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      onError(err.error?.message || `API 错误 ${res.status}`)
      return
    }

    const response = await res.json()
    const hasToolUse = response.content.some(c => c.type === 'tool_use')

    if (!hasToolUse) {
      const text = response.content.filter(c => c.type === 'text').map(c => c.text).join('')
      onChunk(text, text)
      onDone(text)
      return
    }

    // Append assistant message with tool_use blocks
    msgs.push({ role: 'assistant', content: response.content })

    const toolBlocks = response.content.filter(c => c.type === 'tool_use')
    toolBlocks.forEach(b => onToolStatus?.(`调用工具：${b.name}…`))
    const toolResults = await Promise.all(
      toolBlocks.map(async block => {
        const result = await (onToolCall?.(block.name, block.input) ?? Promise.resolve('工具未配置'))
          .catch(e => `错误：${e.message}`)
        return { type: 'tool_result', tool_use_id: block.id, content: String(result) }
      })
    )

    onToolStatus?.('正在整合工具结果…')
    msgs.push({ role: 'user', content: toolResults })
  }

  onError('工具调用轮次超出限制，请稍后重试')
}

async function streamClaude({ apiKey, model, messages, systemPrompt, signal, onChunk, onDone, onError }) {
  let full = ''
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: CLAUDE_HEADERS(apiKey),
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        stream: true,
        ...(systemPrompt ? { system: systemPrompt } : {}),
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
      signal,
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      onError(err.error?.message || `API 错误 ${res.status}`)
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6)
        if (data === '[DONE]') continue
        try {
          const json = JSON.parse(data)
          if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
            full += json.delta.text
            onChunk(json.delta.text, full)
          }
        } catch {}
      }
    }
    onDone(full)
  } catch (err) {
    if (err.name === 'AbortError') {
      onDone(full)
    } else {
      onError(err.message)
    }
  }
}

async function streamOpenAI({ apiKey, baseUrl = 'https://api.openai.com/v1', model, messages, systemPrompt, signal, onChunk, onDone, onError }) {
  let full = ''
  try {
    const allMsgs = []
    if (systemPrompt) allMsgs.push({ role: 'system', content: systemPrompt })
    allMsgs.push(...messages.map(m => ({ role: m.role, content: m.content })))

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, stream: true, messages: allMsgs }),
      signal,
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      onError(err.error?.message || `API 错误 ${res.status}`)
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6)
        if (data === '[DONE]') continue
        try {
          const json = JSON.parse(data)
          const text = json.choices?.[0]?.delta?.content
          if (text) {
            full += text
            onChunk(text, full)
          }
        } catch {}
      }
    }
    onDone(full)
  } catch (err) {
    if (err.name === 'AbortError') {
      onDone(full)
    } else {
      onError(err.message)
    }
  }
}

async function streamOllama({ model, messages, systemPrompt, signal, onChunk, onDone, onError }) {
  const baseUrl = getOllamaBaseUrl()
  let full = ''
  try {
    const allMsgs = []
    if (systemPrompt) allMsgs.push({ role: 'system', content: systemPrompt })
    allMsgs.push(...messages.map(m => ({ role: m.role, content: m.content })))

    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, stream: true, messages: allMsgs }),
      signal,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      let msg = `Ollama 错误 ${res.status}`
      try {
        const err = JSON.parse(body)
        msg = err.error?.message || err.error || msg
      } catch {}
      onError(msg)
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6)
        if (data === '[DONE]') continue
        try {
          const json = JSON.parse(data)
          const text = json.choices?.[0]?.delta?.content
          if (text) {
            full += text
            onChunk(text, full)
          }
        } catch {}
      }
    }
    onDone(full)
  } catch (err) {
    if (err.name === 'AbortError') {
      onDone(full)
    } else {
      onError(err.message)
    }
  }
}

export async function streamMessage({ model = DEFAULT_MODEL, messages, systemPrompt, tools = [], signal, onChunk, onDone, onError, onToolStatus, onToolCall }) {
  const keys = getApiKeys()
  const info = MODELS[model]
  const provider = info?.provider || 'ollama'

  // Tool calling only supported for Claude (OpenAI/Ollama fall through without tools)
  if (tools.length > 0 && provider === 'claude') {
    if (!keys.claude) { onError('请先在设置中填入 Claude API Key'); return }
    const conversationMessages = messages.map(m => ({ role: m.role, content: m.content }))
    await streamClaudeWithTools({ apiKey: keys.claude, model, conversationMessages, systemPrompt, tools, onChunk, onDone, onError, onToolStatus, onToolCall })
    return
  }

  if (!info) {
    const compatModels = getCompatibleModels()
    if (compatModels[model]) {
      const c = getCompatibleConfig()
      if (!c.key) { onError('请先在设置中配置兼容接口 API Key'); return }
      await streamOpenAI({ apiKey: c.key, baseUrl: c.baseUrl, model, messages, systemPrompt, signal, onChunk, onDone, onError })
      return
    }
    await streamOllama({ model, messages, systemPrompt, signal, onChunk, onDone, onError })
    return
  }

  if (info.provider === 'claude') {
    if (!keys.claude) { onError('请先在设置中填入 Claude API Key'); return }
    await streamClaude({ apiKey: keys.claude, model, messages, systemPrompt, signal, onChunk, onDone, onError })
  } else {
    if (!keys.openai) { onError('请先在设置中填入 OpenAI API Key'); return }
    await streamOpenAI({ apiKey: keys.openai, model, messages, systemPrompt, signal, onChunk, onDone, onError })
  }
}

export function parseArtifacts(text) {
  const artifacts = []
  const re = /<artifact\s+type="([^"]+)"\s+title="([^"]+)">([\s\S]*?)<\/artifact>/g
  let m
  while ((m = re.exec(text)) !== null) {
    const type = m[1]
    const title = m[2]
    const body = m[3].trim()
    artifacts.push({
      id: crypto.randomUUID(),
      type,
      title,
      code: type !== 'document' ? body : undefined,
      content: type === 'document' ? body : undefined,
    })
  }
  return artifacts
}

export function stripArtifacts(text) {
  return text.replace(/<artifact[\s\S]*?<\/artifact>/g, '').trim()
}

// 用于流式渲染：同时处理完整和不完整的 artifact 标签，避免原始 XML 显示
export function stripStreamingArtifacts(text) {
  // 移除已完整的 artifact 块
  let result = text.replace(/<artifact[\s\S]*?<\/artifact>/g, '')
  // 移除正在生成中的不完整 artifact（有开头无结束）
  result = result.replace(/<artifact[^>]*>[\s\S]*$/, '\n\n*正在生成产出物…*')
  // 移除只有半个开头标签的情况
  result = result.replace(/<artifact[^>]*$/, '')
  return result.trim()
}

export async function generateProjectMeta(messages, model = DEFAULT_MODEL) {
  return new Promise((resolve, reject) => {
    streamMessage({
      model,
      systemPrompt: `根据以下对话，用JSON格式输出项目名称和当前状态，不要输出任何其他内容：
{"name":"项目名称（5-15字）","status":"当前项目状态（当前进展、最近决策、下一步计划，30-80字）"}`,
      messages: [
        {
          role: 'user',
          content: messages.map(m => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content}`).join('\n\n'),
        },
      ],
      onDone: (full) => {
        try {
          const cleaned = full.replace(/```json\n?|\n?```/g, '').trim()
          const parsed = JSON.parse(cleaned)
          // 兼容旧版 summary 字段
          if (parsed.summary && !parsed.status) parsed.status = parsed.summary
          resolve(parsed)
        } catch {
          resolve({ name: '新项目', status: full.slice(0, 80) })
        }
      },
      onError: reject,
    })
  })
}

// 从对话中提取可复用知识，追加到已有知识库
// Returns array of new knowledge items [{ id, content, date, type }] or null
export async function generateKnowledgeUpdate(messages, existingKnowledge = [], model = DEFAULT_MODEL) {
  const today = new Date().toLocaleDateString('zh-CN')
  const convText = messages.slice(-20)
    .map(m => `${m.role === 'user' ? '用户' : 'AI'}: ${(m.content || '').slice(0, 400)}`)
    .join('\n\n')

  const existingStr = Array.isArray(existingKnowledge)
    ? existingKnowledge.map(k => `- ${k.content}`).join('\n')
    : (existingKnowledge || '')

  return new Promise((resolve) => {
    streamMessage({
      model,
      systemPrompt: `你是项目知识管理助手。从对话中提取可复用的结论、方法、决策，用JSON数组输出，不要输出其他内容：
{"items": [{"content": "结论内容（≤50字）", "type": "conclusion"}]}

type 取值：conclusion（结论）| method（方法）| decision（决策）
- 只提取本次对话新出现的、具体可复用内容
- 不重复已有知识库中的内容
- 如果没有新知识，输出 {"items": []}`,
      messages: [
        {
          role: 'user',
          content: `已有知识库：\n${existingStr || '（空）'}\n\n最近对话：\n${convText}`,
        },
      ],
      onChunk: () => {},
      onDone: (full) => {
        try {
          const cleaned = full.replace(/```json\n?|\n?```/g, '').trim()
          const parsed = JSON.parse(cleaned)
          const items = (parsed.items || []).filter(i => i.content?.trim())
          if (items.length === 0) { resolve(null); return }
          resolve(items.map(i => ({
            id: crypto.randomUUID(),
            content: i.content.trim(),
            date: today,
            type: i.type || 'conclusion',
          })))
        } catch {
          resolve(null)
        }
      },
      onError: () => resolve(null),
    })
  })
}

// 对知识库条目去重整合，返回整合后的数组
export async function consolidateKnowledge(items = [], model = DEFAULT_MODEL) {
  const inputStr = Array.isArray(items)
    ? items.map(k => `- [${k.date || ''}] [${k.type || 'conclusion'}] ${k.content}`).join('\n')
    : items
  return new Promise((resolve) => {
    streamMessage({
      model,
      systemPrompt: `你是项目知识管理助手。对以下知识库进行整合：合并含义相近的条目、删除明显重复内容、保留关键结论。
用JSON数组输出整合后的知识库，格式：
{"items": [{"content": "内容", "date": "原始日期", "type": "conclusion|method|decision"}]}
不输出其他内容。`,
      messages: [{ role: 'user', content: inputStr }],
      onChunk: () => {},
      onDone: (full) => {
        try {
          const cleaned = full.replace(/```json\n?|\n?```/g, '').trim()
          const parsed = JSON.parse(cleaned)
          const result = (parsed.items || []).map(i => ({
            id: crypto.randomUUID(),
            content: i.content?.trim() || '',
            date: i.date || new Date().toLocaleDateString('zh-CN'),
            type: i.type || 'conclusion',
          })).filter(i => i.content)
          resolve(result.length > 0 ? result : items)
        } catch {
          resolve(items)
        }
      },
      onError: () => resolve(items),
    })
  })
}
