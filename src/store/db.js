import { openDB } from 'idb'

const DB_NAME = 'contextos'
const DB_VERSION = 3

let dbPromise = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (!db.objectStoreNames.contains('projects')) {
          const s = db.createObjectStore('projects', { keyPath: 'id' })
          s.createIndex('updatedAt', 'updatedAt')
        }
        if (!db.objectStoreNames.contains('messages')) {
          const s = db.createObjectStore('messages', { keyPath: 'id' })
          s.createIndex('projectId', 'projectId')
          s.createIndex('convId', 'convId')
        }
        if (!db.objectStoreNames.contains('files')) {
          const s = db.createObjectStore('files', { keyPath: 'id' })
          s.createIndex('projectId', 'projectId')
        }
        if (!db.objectStoreNames.contains('conversations')) {
          const s = db.createObjectStore('conversations', { keyPath: 'id' })
          s.createIndex('updatedAt', 'updatedAt')
        }
        if (!db.objectStoreNames.contains('skills')) {
          const s = db.createObjectStore('skills', { keyPath: 'id' })
          s.createIndex('installedAt', 'installedAt')
        }
        if (!db.objectStoreNames.contains('memories')) {
          db.createObjectStore('memories', { keyPath: 'projectId' })
        }

        // v2 → v3 迁移：summary 字段搬到 status（老用户数据兼容）
        if (oldVersion < 3 && db.objectStoreNames.contains('projects')) {
          const store = transaction.objectStore('projects')
          store.openCursor().onsuccess = (e) => {
            const cursor = e.target.result
            if (!cursor) return
            const p = cursor.value
            if (p.summary && !p.status) {
              cursor.update({ ...p, status: p.summary })
            }
            cursor.continue()
          }
        }
      },
    })
  }
  return dbPromise
}

// ── Projects ──────────────────────────────────────────────

export async function getAllProjects() {
  const db = await getDB()
  const items = await db.getAllFromIndex('projects', 'updatedAt')
  return items.reverse()
}

export async function getProject(id) {
  const db = await getDB()
  return db.get('projects', id)
}

export async function saveProject(project) {
  const db = await getDB()
  await db.put('projects', project)
  return project
}

export async function deleteProject(id) {
  const db = await getDB()
  await Promise.all([
    db.delete('projects', id),
    deleteProjectMessages(id),
    deleteProjectFiles(id),
    deleteMemory(id),
  ])
}

async function deleteProjectFiles(projectId) {
  const db = await getDB()
  const all = await db.getAllFromIndex('files', 'projectId', projectId)
  const tx = db.transaction('files', 'readwrite')
  await Promise.all(all.map(f => tx.store.delete(f.id)))
  await tx.done
}

export async function updateProject(id, changes) {
  const db = await getDB()
  const proj = await db.get('projects', id)
  if (!proj) return
  await db.put('projects', { ...proj, ...changes, updatedAt: Date.now() })
}

export async function archiveProject(id) {
  const db = await getDB()
  const proj = await db.get('projects', id)
  if (proj) await db.put('projects', { ...proj, archived: true, status: 'archived', updatedAt: Date.now() })
}

export async function getActiveProjects() {
  const db = await getDB()
  const items = await db.getAllFromIndex('projects', 'updatedAt')
  return items.reverse().filter(p => !p.archived && p.status !== 'archived' && !p.isTemp)
}

export async function getArchivedProjects() {
  const db = await getDB()
  const items = await db.getAllFromIndex('projects', 'updatedAt')
  return items.reverse().filter(p => p.archived || p.status === 'archived')
}

// ── Messages ──────────────────────────────────────────────

export async function getProjectMessages(projectId) {
  const db = await getDB()
  const all = await db.getAllFromIndex('messages', 'projectId', projectId)
  return all.sort((a, b) => a.timestamp - b.timestamp)
}

export async function getConvMessages(convId) {
  const db = await getDB()
  const all = await db.getAllFromIndex('messages', 'convId', convId)
  return all.sort((a, b) => a.timestamp - b.timestamp)
}

export async function saveMessage(msg) {
  const db = await getDB()
  await db.put('messages', msg)
  return msg
}

export async function deleteProjectMessages(projectId) {
  const db = await getDB()
  const all = await db.getAllFromIndex('messages', 'projectId', projectId)
  const tx = db.transaction('messages', 'readwrite')
  await Promise.all(all.map(m => tx.store.delete(m.id)))
  await tx.done
}

export async function deleteMessage(msgId) {
  const db = await getDB()
  await db.delete('messages', msgId)
}

// ── Files ─────────────────────────────────────────────────

export async function getProjectFiles(projectId) {
  const db = await getDB()
  const all = await db.getAllFromIndex('files', 'projectId', projectId)
  return all.sort((a, b) => b.createdAt - a.createdAt)
}

export async function saveFile(file) {
  const db = await getDB()
  await db.put('files', file)
  return file
}

export async function deleteFile(id) {
  const db = await getDB()
  await db.delete('files', id)
}

// ── Conversations (ungrouped) ──────────────────────────────

export async function getAllConversations() {
  const db = await getDB()
  const items = await db.getAllFromIndex('conversations', 'updatedAt')
  return items.reverse()
}

export async function getConversation(id) {
  const db = await getDB()
  return db.get('conversations', id)
}

export async function saveConversation(conv) {
  const db = await getDB()
  await db.put('conversations', conv)
  return conv
}

export async function deleteConversation(id) {
  const db = await getDB()
  await db.delete('conversations', id)
}

export async function updateConversation(id, changes) {
  const db = await getDB()
  const conv = await db.get('conversations', id)
  if (!conv) return
  await db.put('conversations', { ...conv, ...changes, updatedAt: Date.now() })
}

// ── Stats ─────────────────────────────────────────────────

export async function getWeeklyAICount() {
  const db = await getDB()
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
  const all = await db.getAll('messages')
  return all.filter(m => m.role === 'assistant' && m.timestamp > cutoff).length
}

export async function getTotalFilesCount() {
  const db = await getDB()
  const all = await db.getAll('files')
  return all.length
}

export async function getProjectStats(projectId) {
  const db = await getDB()
  const [msgs, files] = await Promise.all([
    db.getAllFromIndex('messages', 'projectId', projectId),
    db.getAllFromIndex('files', 'projectId', projectId),
  ])
  return {
    rounds: msgs.filter(m => m.role === 'assistant').length,
    fileCount: files.length,
    totalChars: msgs.reduce((sum, m) => sum + (m.content?.length || 0), 0),
  }
}

// ── Skills (已安装技能) ────────────────────────────────────

export async function installSkillData(skill) {
  const db = await getDB()
  await db.put('skills', { ...skill, installedAt: skill.installedAt || Date.now() })
}

export async function getInstalledSkillsDB() {
  const db = await getDB()
  const items = await db.getAllFromIndex('skills', 'installedAt')
  return items.reverse()
}

export async function uninstallSkillData(id) {
  const db = await getDB()
  await db.delete('skills', id)
}

// ── Memories (长期记忆) ────────────────────────────────────

export async function getMemory(projectId) {
  const db = await getDB()
  return db.get('memories', projectId)
}

export async function saveMemory(memory) {
  const db = await getDB()
  await db.put('memories', memory)
  return memory
}

export async function deleteMemory(projectId) {
  const db = await getDB()
  await db.delete('memories', projectId)
}

// ── 今日复盘上下文 ─────────────────────────────────────────
// 读取今天有消息的项目和对话，提取 AI 回复摘要作为复盘上下文
export async function getTodayActivity() {
  const db = await getDB()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const cutoff = todayStart.getTime()

  // 今日有更新的正式项目（排除 isTemp 和 archived）
  const allProjects = await db.getAllFromIndex('projects', 'updatedAt')
  const todayProjects = allProjects
    .filter(p => !p.isTemp && !p.archived && p.status !== 'archived' && p.updatedAt >= cutoff)
    .slice(0, 6)

  // 今日有更新的轻量对话
  const allConvs = await db.getAllFromIndex('conversations', 'updatedAt')
  const todayConvs = allConvs.filter(c => c.updatedAt >= cutoff).slice(0, 6)

  // 从消息列表里提取今日摘要（取最后一条 AI 回复前 120 字）
  function extractExcerpt(msgs) {
    const todayMsgs = msgs.filter(m => m.timestamp >= cutoff)
    const aiMsgs = todayMsgs.filter(m => m.role === 'assistant')
    const count = todayMsgs.length
    if (aiMsgs.length === 0) return { count, excerpt: '' }
    const raw = (aiMsgs[aiMsgs.length - 1].content || '')
      .replace(/<artifact[\s\S]*?<\/artifact>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    const excerpt = raw.length > 120 ? raw.slice(0, 118) + '…' : raw
    return { count, excerpt }
  }

  // 消息都存在 projectId 字段（对话类型的 isTemp project 也是同一个 id）
  const projects = (await Promise.all(
    todayProjects.map(async p => {
      const msgs = await db.getAllFromIndex('messages', 'projectId', p.id)
      const { count, excerpt } = extractExcerpt(msgs)
      return count > 0 ? { name: p.name, count, excerpt } : null
    })
  )).filter(Boolean)

  const conversations = (await Promise.all(
    todayConvs.map(async c => {
      const msgs = await db.getAllFromIndex('messages', 'projectId', c.id)
      const { count, excerpt } = extractExcerpt(msgs)
      return count > 0 ? { name: c.title || '无标题对话', count, excerpt } : null
    })
  )).filter(Boolean)

  return {
    projects,
    conversations,
    hasActivity: projects.length > 0 || conversations.length > 0,
  }
}

// ── 全局搜索 ───────────────────────────────────────────────
export async function searchAll(query) {
  if (!query?.trim()) return { projects: [], messages: [] }
  const db = await getDB()
  const q = query.toLowerCase()

  const [allProjects, allMessages] = await Promise.all([
    db.getAllFromIndex('projects', 'updatedAt'),
    db.getAll('messages'),
  ])

  const projects = allProjects
    .filter(p => !p.isTemp && (
      p.name?.toLowerCase().includes(q) ||
      p.summary?.toLowerCase().includes(q) ||
      p.status?.toLowerCase().includes(q)
    ))
    .slice(0, 5)
    .map(p => ({ id: p.id, name: p.name, summary: p.status || p.summary, updatedAt: p.updatedAt }))

  const projectMap = Object.fromEntries(allProjects.map(p => [p.id, p.name]))

  const messages = allMessages
    .filter(m => m.content?.toLowerCase().includes(q))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 20)
    .map(m => ({
      id: m.id, projectId: m.projectId, role: m.role,
      projectName: projectMap[m.projectId] || null,
      excerpt: (() => {
        const idx = m.content.toLowerCase().indexOf(q)
        const start = Math.max(0, idx - 30)
        const end = Math.min(m.content.length, idx + q.length + 60)
        return (start > 0 ? '…' : '') + m.content.slice(start, end) + (end < m.content.length ? '…' : '')
      })(),
      timestamp: m.timestamp,
    }))

  return { projects, messages }
}
