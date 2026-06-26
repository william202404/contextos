import { streamMessage } from './llm'
import { saveMemory as _saveMemory } from '../store/db'

export { getMemory, saveMemory } from '../store/db'

const REFLECTION_SYSTEM = `你是一个记忆管理助手，负责从对话中提取值得长期记忆的信息并与已有记忆合并整理。

要求：
- 以 Markdown bullet 格式输出，每条以 "- " 开头
- 包含：重要事实、用户决策与偏好、关键结论、待跟进事项
- 总条数不超过 15 条，每条不超过 40 字
- 合并重复项，保留最新状态
- 只输出 bullet 列表，不输出任何其他内容`

// 异步触发反思（后台 fork session，不影响主对话）
export async function triggerReflection(projectId, messages, model, currentMemory) {
  const convText = messages
    .slice(-30)
    .map(m => `${m.role === 'user' ? '用户' : 'AI'}：${(m.content || '').slice(0, 400)}`)
    .join('\n\n')

  const existingSection = currentMemory?.content
    ? `\n\n【已有记忆】\n${currentMemory.content}`
    : ''

  const userContent = `【最近对话】\n${convText}${existingSection}`
  const snapshot = currentMemory?.content || ''

  return new Promise(resolve => {
    streamMessage({
      model,
      systemPrompt: REFLECTION_SYSTEM,
      messages: [{ role: 'user', content: userContent }],
      onChunk: () => {},
      onDone: async full => {
        try {
          const content = full.trim()
          if (!content) { resolve(null); return }

          // 安全校验：新条目数 < 旧条目数的 50% 时回滚
          const oldLines = snapshot.split('\n').filter(l => l.trim().startsWith('-')).length
          const newLines = content.split('\n').filter(l => l.trim().startsWith('-')).length
          if (oldLines > 4 && newLines < oldLines * 0.5) { resolve(null); return }

          const now = Date.now()
          const newMemory = {
            projectId,
            content,
            snapshot,
            version: (currentMemory?.version || 0) + 1,
            updatedAt: now,
            createdAt: currentMemory?.createdAt || now,
          }
          await _saveMemory(newMemory)
          resolve(newMemory)
        } catch {
          resolve(null)
        }
      },
      onError: () => resolve(null),
    })
  })
}

// 多因子评分：分数 ≥ 60 时建议触发反思
export function calcReflectionScore(messages) {
  let score = 0
  if (messages.length > 8) score += 30
  if (messages.length > 20) score += 20

  const allText = messages.map(m => m.content || '').join(' ')

  // 决策类关键词
  const decisionWords = ['决定', '确认', '同意', '选择', '采用', '实现', '完成', '记住', '重要', '注意', '计划', '方案', '最终', '确定']
  if (decisionWords.some(w => allText.includes(w))) score += 15

  // 话题重复频率
  const words = allText.split(/[\s，。？！、,.?!\n]+/).filter(w => w.length > 2)
  const freq = {}
  for (const w of words) freq[w] = (freq[w] || 0) + 1
  const repeats = Object.values(freq).filter(c => c > 3).length
  score += Math.min(repeats * 3, 20)

  return score
}
