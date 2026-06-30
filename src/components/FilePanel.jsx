import { useState, useEffect, useRef } from 'react'
import { GitBranch, Network, FileText, Upload, FileArchive, Sparkles, Brain, X, Download, BarChart2 } from 'lucide-react'
import MarkmapViewer from './MarkmapViewer'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'

const FILE_ICONS = {
  flowchart: { Icon: GitBranch,  color: 'var(--accent)',  bg: 'var(--accent-glow)' },
  mindmap:   { Icon: Network,    color: '#0891b2',        bg: 'rgba(8,145,178,0.08)' },
  document:  { Icon: FileText,   color: 'var(--green)',   bg: 'var(--green-bg)' },
  gantt:     { Icon: BarChart2,  color: 'var(--amber)',   bg: 'rgba(251,191,36,0.08)' },
  upload:    { Icon: Upload,     color: 'var(--accent)',  bg: 'var(--accent-glow)' },
  pdf:       { Icon: FileArchive, color: 'var(--red)',    bg: 'var(--red-bg)' },
}

export default function FilePanel({ project, files, messages = [], tokenPercent = 0, onGenerateSummary, onSummaryEdit, onKnowledgeEdit, onConsolidateKnowledge, onClose, memory, reflectionRunning, onMemoryEdit, onReflect }) {
  const { t } = useTranslation()
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
  const knowledgeItems = Array.isArray(project?.knowledge) ? project.knowledge : []
  const knowledgeCount = knowledgeItems.length

  function handleExport() {
    const lines = [`# ${project?.name || project?.name || ''}\n`]
    if (project?.status) {
      lines.push(`${t('filePanel.exportPrefix')}${project.status}\n`)
    }
    if (knowledgeItems.length > 0) {
      lines.push(`${t('filePanel.exportKnowledge')}`)
      knowledgeItems.forEach(k => { lines.push(`- [${k.date || ''}] ${k.content}`) })
      lines.push('')
    }
    if (messages.length > 0) {
      lines.push(`${t('filePanel.exportHistory')}\n`)
      messages.forEach(m => {
        const role = m.role === 'user' ? t('filePanel.me') : t('filePanel.ai')
        const time = m.timestamp ? new Date(m.timestamp).toLocaleString() : ''
        lines.push(`${role}${time ? ` _(${time})_` : ''}\n\n${m.content || ''}\n`)
      })
    }
    const md = lines.join('\n')
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project?.name || t('filePanel.title')}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleDeleteKnowledge(idx) {
    const updated = knowledgeItems.filter((_, i) => i !== idx)
    onKnowledgeEdit?.(updated)
  }

  function handleAddKnowledge() {
    const text = newKnowledge.trim()
    if (!text) return
    const today = new Date().toLocaleDateString('zh-CN')
    const entry = { id: crypto.randomUUID(), content: text, date: today, type: 'conclusion' }
    onKnowledgeEdit?.([...knowledgeItems, entry])
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
          {t('filePanel.title')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={handleExport}
            title={t('filePanel.exportTooltip')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6, borderRadius: 6, display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}
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
            {{ files: t('filePanel.tabFiles'), summary: t('filePanel.tabSummary'), memory: t('filePanel.tabMemory'), history: t('filePanel.tabHistory') }[tab]}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {/* 文件 tab：AI 产出物 + 上传文件 + 上下文用量 */}
        {activeTab === 'files' && (
          <>
            <SectionLabel>{t('filePanel.aiOutputs')}</SectionLabel>
            {aiOutputs.length === 0 ? (
              <Empty>{t('filePanel.noAiOutputs')}</Empty>
            ) : (
              aiOutputs.map(f => <FileItem key={f.id} file={f} onClick={() => setPreviewFile(f)} />)
            )}

            <SectionLabel style={{ marginTop: 14 }}>{t('filePanel.uploads')}</SectionLabel>
            {uploads.length === 0 ? (
              <Empty>{t('filePanel.noUploads')}</Empty>
            ) : (
              uploads.map(f => <FileItem key={f.id} file={f} />)
            )}

            {/* Token usage */}
            <div style={{
              marginTop: 14, background: 'var(--bg-card)',
              border: '1px solid var(--border)', borderRadius: 12, padding: 12,
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                {t('filePanel.contextUsage')}
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
                <span>{t('filePanel.contextUsed', { percent: tokenPercent })}</span>
                <span style={{ fontSize: 10 }}>{t('filePanel.contextWindow')}</span>
              </div>
            </div>
          </>
        )}

        {/* 摘要 tab：当前状态 + 知识库 */}
        {activeTab === 'summary' && (
          <div>
            {/* 子 Tab */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 12, background: 'var(--bg-card)', borderRadius: 8, padding: 3, border: '1px solid var(--border)' }}>
              {[['status', t('filePanel.statusTab')], ['knowledge', knowledgeCount > 0 ? t('filePanel.knowledgeTabCount', { count: knowledgeCount }) : t('filePanel.knowledgeTab')]].map(([key, label]) => (
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
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('filePanel.progressLabel')}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {!editingSummary && onSummaryEdit && (
                      <button onClick={() => { setSummaryDraft(project?.status || project?.summary || ''); setEditingSummary(true) }}
                        style={{ fontSize: 11, padding: '5px 10px', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-muted)', fontWeight: 500 }}>
                        {t('filePanel.edit')}
                      </button>
                    )}
                    {onGenerateSummary && (
                      <button onClick={handleGenerateSummary} disabled={summaryLoading || messages.length < 2}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '5px 10px', borderRadius: 6, cursor: summaryLoading || messages.length < 2 ? 'default' : 'pointer', border: '1px solid var(--border)', background: 'var(--bg-card)', color: summaryLoading || messages.length < 2 ? 'var(--text-muted)' : 'var(--accent)', fontWeight: 500 }}>
                        <Sparkles size={11} />
                        {summaryLoading ? t('filePanel.aiUpdating') : t('filePanel.aiUpdate')}
                      </button>
                    )}
                  </div>
                </div>
                {editingSummary ? (
                  <div>
                    <textarea value={summaryDraft} onChange={e => setSummaryDraft(e.target.value)}
                      style={{ width: '100%', minHeight: 100, padding: 12, borderRadius: 10, border: '1px solid var(--accent-light)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 13, lineHeight: 1.7, fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                      <button onClick={() => setEditingSummary(false)} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)' }}>{t('filePanel.cancel')}</button>
                      <button onClick={() => { onSummaryEdit?.(summaryDraft); setEditingSummary(false) }} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, cursor: 'pointer', border: 'none', background: 'var(--accent)', color: 'white', fontWeight: 600 }}>{t('filePanel.save')}</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, minHeight: 80 }}>
                    {project?.status || project?.summary || <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{t('filePanel.noSummary')}</span>}
                  </div>
                )}
              </div>
            )}

            {summarySubTab === 'knowledge' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {t('filePanel.knowledgeHeader')} <span style={{ fontSize: 9, fontWeight: 400, textTransform: 'none' }}>{t('filePanel.knowledgeAuto')}</span>
                  </div>
                  {onConsolidateKnowledge && knowledgeCount >= 8 && (
                    <button
                      onClick={async () => {
                        if (consolidating) return
                        setConsolidating(true)
                        try { await onConsolidateKnowledge() } finally { setConsolidating(false) }
                      }}
                      disabled={consolidating}
                      style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, padding: '5px 10px', borderRadius: 6, cursor: consolidating ? 'default' : 'pointer', border: '1px solid var(--border)', background: 'var(--bg-card)', color: consolidating ? 'var(--text-muted)' : 'var(--accent)', fontWeight: 500 }}
                      title={t('filePanel.consolidateTooltip')}
                    >
                      <Sparkles size={10} />
                      {consolidating ? t('filePanel.consolidating') : t('filePanel.consolidate')}
                    </button>
                  )}
                </div>
                {knowledgeItems.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {knowledgeItems.map((item, i) => (
                      <div key={item.id || i} style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', position: 'relative' }}
                        className="knowledge-entry">
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1, opacity: 0.8 }}>💡</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{item.content}</span>
                            {item.date && (
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{item.date}</div>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                            <button onClick={() => navigator.clipboard.writeText(item.content)}
                              title={t('filePanel.copy')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 10, padding: '4px 6px', borderRadius: 4 }}>
                              {t('filePanel.copy')}
                            </button>
                            {onKnowledgeEdit && (
                              <button onClick={() => handleDeleteKnowledge(i)}
                                title={t('project.delete')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, padding: '4px 6px', borderRadius: 4, lineHeight: 1 }}
                                onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                                ×
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '16px 4px', lineHeight: 1.7 }}>
                    {t('filePanel.noKnowledge')}
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
                          placeholder={t('filePanel.addKnowledgePlaceholder')}
                          rows={2}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--accent-border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit', resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.55 }}
                        />
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button onClick={() => { setAddingKnowledge(false); setNewKnowledge('') }}
                            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)' }}>{t('filePanel.cancel')}</button>
                          <button onClick={handleAddKnowledge}
                            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', border: 'none', background: 'var(--accent)', color: 'white', fontWeight: 600 }}>{t('filePanel.add')}</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setAddingKnowledge(true)}
                        style={{ width: '100%', padding: '6px 0', borderRadius: 8, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                        {t('filePanel.addKnowledge')}
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
  const { t } = useTranslation()
  const mermaidRef = useRef(null)
  const isMermaid = file.type === 'flowchart' || file.type === 'gantt'

  useEffect(() => {
    if (!isMermaid || !file.code || !mermaidRef.current) return
    let cancelled = false
    import('../lib/mermaidInit').then(({ getMermaid }) => getMermaid()).then((mermaid) => {
      const id = `fp-${file.id.slice(0, 8)}-${Date.now()}`
      return mermaid.render(id, file.code)
    }).then(({ svg }) => {
      if (cancelled || !mermaidRef.current) return
      const host = mermaidRef.current
      if (!host.shadowRoot) host.attachShadow({ mode: 'open' })
      host.shadowRoot.innerHTML = `<style>:host{display:block}svg{max-width:100%;height:auto}</style>${svg}`
    }).catch(() => {
      if (!cancelled && mermaidRef.current) mermaidRef.current.textContent = file.code
    })
    return () => { cancelled = true }
  }, [file.id, file.code, isMermaid])

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
          ) : isMermaid && file.code ? (
            <div ref={mermaidRef} style={{ display: 'flex', justifyContent: 'center', padding: 12 }} />
          ) : file.content ? (
            <pre style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>{file.content}</pre>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', paddingTop: 40 }}>{t('filePanel.noPreview')}</div>
          )}
        </div>
      </div>
    </div>
  )
}

function HistoryTab({ messages }) {
  const { t } = useTranslation()
  if (messages.length === 0) {
    return <Empty>{t('filePanel.noHistory')}</Empty>
  }

  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()

  const grouped = messages.reduce((acc, m) => {
    const d = new Date(m.timestamp)
    const key = d.toDateString()
    const label = key === today ? t('filePanel.today') : key === yesterday ? t('filePanel.yesterday') : d.toLocaleDateString(i18n.language === 'zh' ? 'zh-CN' : undefined, { month: 'long', day: 'numeric' })
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
            {label} · {msgs.length}
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
                  {m.role === 'user' ? t('chatMessage.me') : 'AI'}
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
                  {new Date(m.timestamp).toLocaleTimeString(i18n.language === 'zh' ? 'zh-CN' : undefined, { hour: '2-digit', minute: '2-digit' })}
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
  if (diff < 60_000) return i18n.t('filePanel.justNow')
  if (diff < 3_600_000) return i18n.t('filePanel.minutesAgo', { count: Math.floor(diff / 60_000) })
  return new Date(ts).toLocaleDateString(i18n.language === 'zh' ? 'zh-CN' : undefined)
}

function MemoryTab({ memory, reflectionRunning, onSave, onReflect, messageCount }) {
  const { t } = useTranslation()
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
          {t('filePanel.memoryTitle')}
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
          {reflectionRunning ? t('filePanel.reflecting') : t('filePanel.reflect')}
        </button>
      </div>

      {editing ? (
        <div>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            autoFocus
            placeholder={t('filePanel.memoryPlaceholder')}
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
            >{t('filePanel.cancel')}</button>
            <button
              onClick={saveEdit}
              style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, cursor: 'pointer', background: 'var(--accent)', border: 'none', color: 'white', fontWeight: 600 }}
            >{t('filePanel.save')}</button>
          </div>
        </div>
      ) : (
        <div
          onClick={startEdit}
          title={t('filePanel.clickToEdit')}
          style={{
            fontSize: 12, lineHeight: 1.75, color: memory?.content ? 'var(--text-secondary)' : 'var(--text-muted)',
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 14,
            minHeight: 120, cursor: 'text', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}
        >
          {memory?.content || t('filePanel.noMemory')}
        </div>
      )}

      {reflectionRunning && (
        <div style={{
          marginTop: 10, padding: '8px 12px', borderRadius: 8,
          background: 'var(--accent-glow)', border: '1px solid var(--border)',
          fontSize: 11, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ animation: 'spin 1.2s linear infinite', display: 'inline-block' }}>⚙</span>
          {t('filePanel.reflectingMsg')}
        </div>
      )}

      {memory?.updatedAt && !reflectionRunning && (
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8, textAlign: 'right' }}>
          {t('filePanel.lastUpdated', { time: formatTime(memory.updatedAt) })}
        </div>
      )}
    </div>
  )
}
