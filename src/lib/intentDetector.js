export const INTENT = {
  CONTINUE: 'continue',
  NEW_TOPIC: 'new_topic',
  KNOWLEDGE_QUERY: 'knowledge_query',
  DECISION: 'decision',
}

const KNOWLEDGE_RE = /之前|上次|我们讨论过|你之前说|之前的结论|之前提到|刚才说的|上次聊的|以前说的|结论是什么|之前定的|历史上下文|之前积累/
const NEW_TOPIC_RE = /另外|换个话题|新问题|顺便问|跟这个无关|还有个问题|不相关的|转个话题|说个别的/
const DECISION_RE = /怎么选|哪个好|建议|应该|值不值得|要不要|该怎么|选哪个|权衡|对比|优劣|怎么判断|帮我决定|你觉得哪|哪种方案/

export function detectIntent(userMessage, recentMessages = []) {
  const msg = userMessage

  if (KNOWLEDGE_RE.test(msg)) return INTENT.KNOWLEDGE_QUERY
  if (DECISION_RE.test(msg)) return INTENT.DECISION
  if (NEW_TOPIC_RE.test(msg)) return INTENT.NEW_TOPIC

  // 超短回复（跟进确认类）→ 直接 continue，不需要重注入上下文
  if (userMessage.length < 12 && recentMessages.length > 0) return INTENT.CONTINUE

  return INTENT.CONTINUE
}
