import { INTENT } from './intentDetector'

// 按用户消息关键词对知识条目做相关度排序，最多返回 maxLines 条
function filterKnowledge(knowledge, userMessage, maxLines = 8) {
  if (!knowledge) return ''
  const lines = knowledge.split('\n').filter(l => l.trim())
  if (lines.length <= maxLines) return knowledge

  const words = (userMessage.match(/[一-龥a-z0-9]{2,}/g) || [])
  if (words.length === 0) return lines.slice(0, maxLines).join('\n')

  const scored = lines.map(line => ({
    line,
    score: words.reduce((s, w) => s + (line.includes(w) ? 1 : 0), 0),
  }))
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, maxLines).map(e => e.line).join('\n')
}

// 返回用于 context bar 显示的注入说明（不含技能）
export function describeInjection(intent, project) {
  if (!project || project.isTemp) return null
  const hasStatus = !!project.status && !['active', 'archived'].includes(project.status)
  const knowledgeLines = (project.knowledge || '').split('\n').filter(l => l.trim())
  const kCount = Math.min(knowledgeLines.length, 8)

  switch (intent) {
    case INTENT.KNOWLEDGE_QUERY:
      return kCount > 0 ? `${kCount} 条知识` : '知识库为空'
    case INTENT.NEW_TOPIC:
      return '跳过历史上下文'
    case INTENT.DECISION: {
      const parts = [hasStatus && '状态', kCount > 0 && `${kCount} 条知识`].filter(Boolean)
      return parts.length > 0 ? parts.join(' + ') : '暂无上下文'
    }
    default: // continue
      return hasStatus ? '状态已注入' : '暂无状态'
  }
}

export function buildProjectContext(intent, project, memory, skills = [], userMessage = '') {
  if (!project || project.isTemp) return null

  const { name, status, knowledge } = project
  const memoryText = memory?.content || ''
  const hasStatus = status && !['active', 'archived'].includes(status)
  const relevantKnowledge = filterKnowledge(knowledge, userMessage)

  let ctx

  switch (intent) {
    case INTENT.KNOWLEDGE_QUERY:
      ctx = [
        `你正在协助项目「${name}」。`,
        relevantKnowledge
          ? `\n项目积累的知识和结论：\n${relevantKnowledge}`
          : '\n（项目知识库暂无内容）',
        memoryText ? `\n\n项目记忆：\n${memoryText}` : '',
      ].filter(Boolean).join('')
      break

    case INTENT.NEW_TOPIC:
      ctx = `你正在协助项目「${name}」的一个新话题，请直接基于用户问题作答。`
      break

    case INTENT.DECISION:
      ctx = [
        `你正在协助项目「${name}」的一个决策问题。`,
        hasStatus ? `\n当前项目状态：\n${status}` : '',
        relevantKnowledge ? `\n\n项目积累的知识：\n${relevantKnowledge}` : '',
        memoryText ? `\n\n项目记忆：\n${memoryText}` : '',
      ].filter(Boolean).join('')
      break

    default: // continue
      ctx = [
        hasStatus
          ? `你正在协助项目「${name}」。\n当前项目状态：\n${status}`
          : `你正在协助项目「${name}」。`,
        memoryText ? `\n\n项目记忆：\n${memoryText}` : '',
      ].filter(Boolean).join('')
      break
  }

  // 自动匹配的技能（pinned skill 由 basePrompt 处理，不在此注入避免重复）
  if (skills.length > 0) {
    ctx += '\n\n---'
    for (const skill of skills) {
      if (skill?.systemPrompt) {
        ctx += `\n【激活技能：${skill.name}】\n${skill.systemPrompt}`
      }
    }
  }

  return ctx
}
