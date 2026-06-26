import { useState, useEffect, useRef } from 'react'
import { GitBranch, Network, FileText, Upload, FileArchive, Sparkles, Brain, X, Download } from 'lucide-react'
import MarkmapViewer from './MarkmapViewer'

const FILE_ICONS = {
  flowchart: { Icon: GitBranch, color: 'var(--accent)', bg: 'var(--accent-glow)' },
  mindmap:   { Icon: Network,    color: '#0891b2', bg: 'rgba(8,145,178,0.08)' },
  document:  { Icon: FileText,   color: 'var(--green)', bg: 'var(--green-bg)' },
  upload:    { Icon: Upload,     color: 'var(--accent)', bg: 'var(--accent-glow)' },
  pdf:       { Icon: FileArchive, color: 'var(--red)', bg: 'var(--red-bg)' },
}

export default function FilePanel({ project, files, messages = [], tokenPercent = 0, onGenerateSummary, onSummaryEdit, onKnowledgeEdit, onConsolidateKnowledge, onClose, memory, reflectionRunning, onMemoryEdit, onReflect }) {
  const [activeTab, setActiveTab] = useState('files')
  const [summarySubTab, setSummarySubTab] = useState('status') // 'status' | 'knowledge'
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [editingSummary, setEditingSummary] = useState(false)
  const [summaryDraft, setSummaryDraft] = useState('')
  const [previewFile, setPreviewFile] = useState(null)
  const [newKnowledge, setNewKnowledge] = useState('')
  const [addingKnowledge, setAddingKnowledge] = useState(false)
  const [consolidating, setConsolidating] = useState(false)

  const aiOutputs = files.filter(f => f.source === 'ai')
  const uploads = files.filter(f => f.source === 'upload')
  const knowledgeCount = project?.knowledge
    ? project.knowledge.split('\n').filter(l => l.trim()).length
    : 0

  function handleExport() {
    const lines = [`# ${project?.name || '项目'}\n`]
    if (project?.status) {
      lines.push(`## 当前状态\n\n${project.status}\n`)
    }
    if (project?.knowledge) {
      lines.push(`## 积累知识\n\n${project.knowledge}\n`)
    }
    if (messages.length > 0) {
      lines.push('## 对话记录\n')
      messages.forEach(m => {
        const role = m.role === 'user' ? '**我**' : '**AI**'
        const time = m.timestamp ? new Date(m.timestamp).toLocaleString('zh-CN') : ''
        lines.push(`${role}${time ? ` _(${time})_` : ''}\n\n${m.content || ''}\n`)
      })
    }
    const md = lines.join('\n')
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project?.name || '项目'}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleDeleteKnowledge(idx) {
    const lines = (project?.knowledge || '').split('\n').filter(l => l.trim())
    lines.splice(idx, 1)
    onKnowledgeEdit?.(lines.join('\n'))
  }

  function handleAddKnowledge() {
    const text = newKnowledge.trim()
    if (!text) return
    const today = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
    const entry = `- [${today}] ${text}`
    const existing = project?.knowledge || ''
    onKnowledgeEdit?.(existing ? existing + '\n' + entry : entry)
    setNewKnowledge('')
    setAddingKnowledge(false)
  }

  async function handleGenerateSummary() {
    setSummaryLoading(true)
    try {
      await onGenerateSummary?.()
    } finally {
      setSummaryLoading(false)
    }
  }

  return (
    <aside style={{
      width: 280, minWidth: 280,
      background: 'var(--bg-surface)',
      borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          项目文件
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={handleExport}
            title="导出为 Markdown"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <Download size={13} />
          </button>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{project?.name}</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {['files', 'summary', 'memory', 'history'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1, padding: '9px 0', textAlign: 'center',
              fontSize: 11.5, fontWeight: 500, cursor: 'pointer', border: 'none',
              background: 'transparent',
              color: activeTab === tab ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: `2px solid ${activeTab === tab ? 'var(--accent)' : 'transparent'}`,
              transition: 'all 0.15s',
            }}
          >
            {{ files: '文件', summary: '摘要', memory: '记忆', history: '历史' }[tab]}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {/* 文件 tab：AI 产出物 + 上传文件 + 上下文用量 */}
        {activeTab === 'files' && (
          <>
            <SectionLabel>AI 产出物</SectionLabel>
            {aiOutputs.length === 0 ? (
              <Empty>暂无 AI 产出物</Empty>
            ) : (
              aiOutputs.map(f => <FileItem key={f.id} file={f} onClick={() => setPreviewFile(f)} />)
            )}

            <SectionLabel style={{ marginTop: 14 }}>上传文件</SectionLabel>
            {uploads.length === 0 ? (
              <Empty>暂无上传文件</Empty>
            ) : (
              uploads.map(f => <FileItem key={f.id} file={f} />)
            )}

            {/* Token usage */}
            <div style={{
              marginTop: 14, background: 'var(--bg-card)',
              border: '1px solid var(--border)', borderRadius: 12, padding: 12,
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                上下文用量
              </div>
              <div style={{ background: 'var(--bg-hover)', borderRadius: 4, height: 5, overflow: 'hidden', marginBottom: 6 }}>
                <div style={{
                  height: '100%', borderRadius: 4,
                  background: tokenPercent > 70
                    ? 'linear-gradient(90deg, #d97706, #f59e0b)'
                    : 'linear-gradient(90deg, var(--accent), var(--accent-light))',
                  width: `${tokenPercent}%`,
                  transition: 'width 0.4s',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                <span>{tokenPercent}% 已使用</span>
                <span style={{ fontSize: 10 }}>约 200k 上下文窗口</span>
              </div>
            </div>
          </>
        )}

        {/* 摘要 tab：当前状态 + 知识库 */}
        {activeTab === 'summary' && (
          <div>
            {/* 子 Tab */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 12, background: 'var(--bg-card)', borderRadius: 8, padding: 3, border: '1px solid var(--border)' }}>
              {[['status', '当前状态'], ['knowledge', knowledgeCount > 0 ? `知识库 (${knowledgeCount})` : '知识库']].map(([key, label]) => (
                <button key={key} onClick={() => setSummarySubTab(key)} style={{
                  flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 11.5, fontWeight: 600,
                  cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                  background: summarySubTab === key ? 'var(--accent)' : 'transparent',
                  color: summarySubTab === key ? 'white' : 'var(--text-muted)',
                }}>{label}</button>
              ))}
            </div>

            {summarySubTab === 'status' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>项目当前进展</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {!editingSummary && onSummaryEdit && (
                      <button onClick={() => { setSummaryDraft(project?.status || project?.summary || ''); setEditingSummary(true) }}
                        style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-muted)', fontWeight: 500 }}>
                        编辑
                      </button>
                    )}
                    {onGenerateSummary && (
                      <button onClick={handleGenerateSummary} disabled={summaryLoading || messages.length < 2}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 8px', borderRadius: 6, cursor: summaryLoading || messages.length < 2 ? 'default' : 'pointer', border: '1px solid var(--border)', background: 'var(--bg-card)', color: summaryLoading || messages.length < 2 ? 'var(--text-muted)' : 'var(--accent)', fontWeight: 500 }}>
                        <Sparkles size={11} />
                        {summaryLoading ? '生成中…' : 'AI 更新'}
                      </button>
                    )}
                  </div>
                </div>
                {editingSummary ? (
                  <div>
                    <textarea value={summaryDraft} onChange={e => setSummaryDraft(e.target.value)}
                      style={{ width: '100%', minHeight: 100, padding: 12, borderRadius: 10, border: '1px solid var(--accent-light)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 13, lineHeight: 1.7, fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                      <button onClick={() => setEditingSummary(false)} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)' }}>取消</button>
                      <button onClick={() => { onSummaryEdit?.(summaryDraft); setEditingSummary(false) }} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, cursor: 'pointer', border: 'none', background: 'var(--accent)', color: 'white', fontWeight: 600 }}>保存</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, minHeight: 80 }}>
                    {project?.status || project?.summary || <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>暂无摘要。继续对话，AI 会自动提炼。</span>}
                  </div>
                )}
              </div>
            )}

            {summarySubTab === 'knowledge' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    积累知识 <span style={{ fontSize: 9, fontWeight: 400, textTransform: 'none' }}>（AI 自动提取）</span>
                  </div>
                  {onConsolidateKnowledge && knowledgeCount >= 8 && (
                    <button
                      onClick={async () => {
                        if (consolidating) return
                        setConsolidating(true)
                        try { await onConsolidateKnowledge() } finally { setConsolidating(false) }
                      }}
                      disabled={consolidating}
                      style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, padding: '3px 8px', borderRadius: 6, cursor: consolidating ? 'default' : 'pointer', border: '1px solid var(--border)', background: 'var(--bg-card)', color: consolidating ? 'var(--text-muted)' : 'var(--accent)', fontWeight: 500 }}
                      title="AI 合并重复条目，压缩知识库体积"
                    >
                      <Sparkles size={10} />
                      {consolidating ? '整合中…' : '整合'}
                    </button>
                  )}
                </div>
                {project?.knowledge ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {project.knowledge.split('\n').filter(l => l.trim()).map((line, i) => {
                      const match = line.match(/^-?\s*\[([^\]]+)\]\s*(.+)$/)
                      const date = match?.[1]
                      const content = match ? match[2] : line.replace(/^-\s*/, '')
                      return (
                        <div key={i} style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', position: 'relative' }}
                          className="knowledge-entry">
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1, opacity: 0.8 }}>💡</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{content}</span>
                              {date && (
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{date}</div>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                              <button onClick={() => navigator.clipboard.writeText(content)}
                                title="复制" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 10, padding: '2px 4px', borderRadius: 4 }}>
                                复制
                              </button>
                              {onKnowledgeEdit && (
                                <button onClick={() => handleDeleteKnowledge(i)}
                                  title="删除" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, padding: '2px 4px', borderRadius: 4, lineHeight: 1 }}
                                  onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                                  ×
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '16px 4px', lineHeight: 1.7 }}>
                    暂无积累知识。继续对话，AI 会自动从对话中提取可复用结论存入此处。
                  </div>
                )}

                {/* 手动添加知识 */}
                {onKnowledgeEdit && (
                  <div style={{ marginTop: 8 }}>
                    {addingKnowledge ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <textarea
                          autoFocus
                          value={newKnowledge}
                          onChange={e => setNewKnowledge(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddKnowledge() } if (e.key === 'Escape') { setAddingKnowledge(false); setNewKnowledge('') } }}
                          placeholder="输入要记录的知识或结论…"
                          rows={2}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--accent-border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit', resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.55 }}
                        />
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button onClick={() => { setAddingKnowledge(false); setNewKnowledge('') }}
                            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)' }}>取消</button>
                          <button onClick={handleAddKnowledge}
                            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', border: 'none', background: 'var(--accent)', color: 'white', fontWeight: 600 }}>添加</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setAddingKnowledge(true)}
                        style={{ width: '100%', padding: '6px 0', borderRadius: 8, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                        + 手动添加知识
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 记忆 tab */}
        {activeTab === 'memory' && (
          <MemoryTab
            memory={memory}
            reflectionRunning={reflectionRunning}
            onSave={onMemoryEdit}
            onReflect={onReflect}
            messageCount={messages.length}
          />
        )}

        {/* 历史 tab：消息时间线 */}
        {activeTab === 'history' && (
          <HistoryTab messages={messages} />
        )}
      </div>

      {previewFile && (
        <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
      )}
    </aside>
  )
}

function FilePreviewModal({ file, onClose }) {
  const mermaidRef = useRef(null)

  useEffect(() => {
    if (file.type === 'flowchart' && file.code && mermaidRef.current) {
      let cancelled = false
      import('../lib/mermaidInit').then(({ getMermaid }) => getMermaid()).then((mermaid) => {
        const id = `fp-${file.id.slice(0, 8)}-${Date.now()}`
        return mermaid.render(id, file.code)
      }).then(({ svg }) => {
        if (!cancelled && mermaidRef.current) mermaidRef.current.innerHTML = svg
      }).catch(() => {
        if (!cancelled && mermaidRef.current) mermaidRef.current.textContent = file.code
      })
      return () => { cancelled = true }
    }
  }, [file.id, file.code, file.type])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 16, padding: 24, width: '80vw', maxWidth: 760,
        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        boxShadow: 'var(--shadow-lg)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {(() => { const info = FILE_ICONS[file.type] || FILE_ICONS.upload; const { Icon } = info; return <Icon size={16} color={info.color} /> })()}
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{file.name}</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border)', padding: file.type === 'mindmap' ? 0 : 16 }}>
          {file.type === 'mindmap' && file.code ? (
            <div style={{ height: 400 }}>
              <MarkmapViewer markdown={file.code} minHeight={400} />
            </div>
          ) : file.type === 'flowchart' && file.code ? (
            <div ref={mermaidRef} style={{ display: 'flex', justifyContent: 'center' }} />
          ) : file.content ? (
            <pre style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>{file.content}</pre>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', paddingTop: 40 }}>暂无可预览内容</div>
          )}
        </div>
      </div>
    </div>
  )
}

function HistoryTab({ messages }) {
  if (messages.length === 0) {
    return <Empty>暂无对话记录</Empty>
  }

  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()

  const grouped = messages.reduce((acc, m) => {
    const d = new Date(m.timestamp)
    const key = d.toDateString()
    const label = key === today ? '今天' : key === yesterday ? '昨天' : d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
    if (!acc[label]) acc[label] = []
    acc[label].push(m)
    return acc
  }, {})

  return (
    <div>
      {Object.entries(grouped).map(([label, msgs]) => (
        <div key={label} style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.06em',
            marginBottom: 8, padding: '0 2px',
          }}>
            {label} · {msgs.length} 条
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {msgs.map(m => (
              <div key={m.id} style={{
                display: 'flex', gap: 8, alignItems: 'flex-start',
                padding: '7px 10px', borderRadius: 8,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
              }}>
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 4, flexShrink: 0, marginTop: 1,
                  background: m.role === 'user' ? 'var(--accent-glow)' : 'var(--green-bg)',
                  color: m.role === 'user' ? 'var(--accent)' : 'var(--green)',
                }}>
                  {m.role === 'user' ? '我' : 'AI'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {m.content?.slice(0, 40) || '…'}
                  </div>
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
                  {new Date(m.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function SectionLabel({ children, style }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
      textTransform: 'uppercase', letterSpacing: '0.04em',
      marginBottom: 8, marginTop: 4, ...style,
    }}>
      {children}
    </div>
  )
}

function Empty({ children }) {
  return (
    <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 4px' }}>
      {children}
    </div>
  )
}

function FileItem({ file, onClick }) {
  const info = FILE_ICONS[file.type] || FILE_ICONS.upload
  const { Icon } = info
  const isNew = file.createdAt && Date.now() - file.createdAt < 60_000
  const canPreview = onClick && (file.code || file.content)

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 10px', borderRadius: 10, cursor: canPreview ? 'pointer' : 'default',
      transition: 'all 0.15s', marginBottom: 2,
    }}
      onClick={canPreview ? onClick : undefined}
      onMouseEnter={e => { if (canPreview) e.currentTarget.style.background = 'var(--bg-hover)' }}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{
        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
        background: info.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={14} color={info.color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {file.name}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
          {file.meta || formatTime(file.createdAt)}
        </div>
      </div>
      {isNew && (
        <span style={{
          fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
          background: 'var(--accent-glow)', color: 'var(--accent)', flexShrink: 0,
        }}>
          NEW
        </span>
      )}
    </div>
  )
}

function formatTime(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分钟前`
  return new Date(ts).toLocaleDateString('zh-CN')
}

function MemoryTab({ memory, reflectionRunning, onSave, onReflect, messageCount }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  function startEdit() {
    setDraft(memory?.content || '')
    setEditing(true)
  }

  function saveEdit() {
    onSave?.(draft.trim())
    setEditing(false)
  }

  const canReflect = !reflectionRunning && messageCount >= 4

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          项目记忆
          {(memory?.version ?? 0) > 0 && (
            <span style={{ marginLeft: 5, fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 10 }}>
              v{memory.version}
            </span>
          )}
        </div>
        <button
          onClick={onReflect}
          disabled={!canReflect}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: canReflect ? 'pointer' : 'default',
            border: '1px solid var(--border)', background: 'var(--bg-card)',
            color: canReflect ? 'var(--accent)' : 'var(--text-muted)',
            fontWeight: 500, transition: 'all 0.15s',
          }}
        >
          <Brain size={11} />
          {reflectionRunning ? '反思中…' : '立即反思'}
        </button>
      </div>

      {editing ? (
        <div>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            autoFocus
            placeholder="- 用 bullet 格式记录重要信息&#10;- 例如：用户偏好使用 TypeScript&#10;- 例如：已确认采用 React Router"
            style={{
              width: '100%', minHeight: 200, background: 'var(--bg-input)',
              border: '1px solid var(--accent)', borderRadius: 10, padding: 12,
              color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit',
              lineHeight: 1.7, resize: 'vertical', outline: 'none', boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setEditing(false)}
              style={{ fontSize: 11, padding: '5px 10px', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)' }}
            >取消</button>
            <button
              onClick={saveEdit}
              style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, cursor: 'pointer', background: 'var(--accent)', border: 'none', color: 'white', fontWeight: 600 }}
            >保存</button>
          </div>
        </div>
      ) : (
        <div
          onClick={startEdit}
          title="点击编辑"
          style={{
            fontSize: 12, lineHeight: 1.75, color: memory?.content ? 'var(--text-secondary)' : 'var(--text-muted)',
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 14,
            minHeight: 120, cursor: 'text', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}
        >
          {memory?.content || '暂无记忆条目。\n\n点此编辑手动添加，或点"立即反思"从对话中自动提取。'}
        </div>
      )}

      {reflectionRunning && (
        <div style={{
          marginTop: 10, padding: '8px 12px', borderRadius: 8,
          background: 'var(--accent-glow)', border: '1px solid var(--border)',
          fontSize: 11, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ animation: 'spin 1.2s linear infinite', display: 'inline-block' }}>⚙</span>
          AI 正在提取对话记忆…
        </div>
      )}

      {memory?.updatedAt && !reflectionRunning && (
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8, textAlign: 'right' }}>
          上次更新：{formatTime(memory.updatedAt)}
        </div>
      )}
    </div>
  )
}
