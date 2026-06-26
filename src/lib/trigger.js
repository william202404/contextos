import { getApiKeys } from './llm'

const KEYWORDS = ['需求', '方案', '功能', '决策', '分析', '报告', 'demo']
const KEYWORD_WINDOW = 3
const KEYWORD_THRESHOLD = 3
const ROUND_THRESHOLD = 8

export function checkTrigger(messages, hasFileUploaded = false) {
  if (hasFileUploaded) return true

  const userMessages = messages.filter(m => m.role === 'user')
  if (userMessages.length >= ROUND_THRESHOLD) return true

  const recent = userMessages.slice(-KEYWORD_WINDOW)
  const text = recent.map(m => m.content).join(' ')
  let count = 0
  for (const kw of KEYWORDS) {
    const matches = text.match(new RegExp(kw, 'g'))
    if (matches) count += matches.length
  }

  return count >= KEYWORD_THRESHOLD
}

// 判断 AI 回复是否包含高价值内容，用于决定是否提示归档
export async function checkSemanticTrigger(assistantMessage, model = 'claude-haiku-4-5-20251001') {
  const { claude: apiKey } = getApiKeys()
  if (!apiKey || !assistantMessage) return { isHighValue: false, reason: '' }

  const prompt = `你是一个内容分类器。判断以下 AI 回复是否包含"高价值内容"。

高价值内容定义（满足任意一条即为 true）：
1. 产生了明确的结论、判断或建议（而非只是提供信息）
2. 包含可复用的方法、框架或流程
3. 涉及产品方向、架构设计或关键决策
4. 总结了某个问题的根本原因或解决方案

回复内容：
${assistantMessage.slice(0, 800)}

只输出 JSON：{"isHighValue": true/false, "reason": "一句话说明"}`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: 100,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) return { isHighValue: false, reason: '' }
    const data = await res.json()
    const text = data.content?.find(c => c.type === 'text')?.text || ''
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    return { isHighValue: false, reason: '' }
  }
}
