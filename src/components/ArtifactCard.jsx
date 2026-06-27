import { useEffect, useRef, useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { GitBranch, Network, FileText, Pencil, X, Check, ZoomIn, ZoomOut, Maximize2, RotateCcw, Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'
const getMermaid = () => import('../lib/mermaidInit').then(m => m.getMermaid())
import MarkmapViewer from './MarkmapViewer'

const TYPE_MAP = {
  flowchart: { Icon: GitBranch, color: 'var(--accent)',  bg: 'var(--accent-glow)' },
  mindmap:   { Icon: Network,   color: 'var(--cyan)',   bg: 'var(--cyan-bg)' },
  document:  { Icon: FileText,  color: 'var(--green)',  bg: 'var(--green-bg)' },
}

export default function ArtifactCard({ artifact, onSave, onUpdate, onRequestAiEdit }) {
  const { t } = useTranslation()
  const info = TYPE_MAP[artifact.type] || TYPE_MAP.document
  const { Icon } = info
  const typeLabel = t(`artifact.${artifact.type}`, artifact.type)
  const isMermaid  = artifact.type === 'flowchart'
  const isMindmap  = artifact.type === 'mindmap'
  const isDocument = artifact.type === 'document'

  // ── Mermaid: normal view ─────────────────────────────────
  const mermaidRef  = useRef(null)
  const flowWrapRef = useRef(null)
  const [mermaidRendered, setMermaidRendered] = useState(false)
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [isDragging, setIsDragging] = useState(false)
  const isDraggingRef = useRef(false)
  const lastPosRef    = useRef({ x: 0, y: 0 })

  // ── Mermaid: fullscreen view (separate render, no shared ref) ──
  const flowWrapFsRef = useRef(null)
  const [fullscreenSvg, setFullscreenSvg] = useState('')
  const [transformFs, setTransformFs] = useState({ x: 0, y: 0, scale: 1 })
  const [isDraggingFs, setIsDraggingFs] = useState(false)
  const isDraggingFsRef = useRef(false)
  const lastPosFsRef    = useRef({ x: 0, y: 0 })

  // ── Edit state ───────────────────────────────────────────
  const [editMode,    setEditMode]   = useState(false)
  const [editSubMode, setEditSubMode] = useState('code') // 'code' | 'ai'
  const [aiEditText,  setAiEditText]  = useState('')
  const [draft,      setDraft]     = useState('')
  const [previewSvg, setPreviewSvg] = useState('')
  const debounceRef = useRef(null)

  // ── Fullscreen ───────────────────────────────────────────
  const [fullscreen, setFullscreen] = useState(false)

  // ── Effects ──────────────────────────────────────────────

  // Render Mermaid in the normal view
  useEffect(() => {
    if (!isMermaid || editMode) return
    if (!artifact.code || !mermaidRef.current) return
    let cancelled = false
    getMermaid().then(mermaid => {
      const id = `mer-${artifact.id.slice(0, 8)}-${Date.now()}`
      return mermaid.render(id, artifact.code)
    }).then(({ svg }) => {
      if (cancelled || !mermaidRef.current) return
      const host = mermaidRef.current
      if (!host.shadowRoot) host.attachShadow({ mode: 'open' })
      host.shadowRoot.innerHTML = `<style>:host{display:block}svg{max-width:none}</style>${svg}`
      setMermaidRendered(true)
    }).catch(() => {
      if (!cancelled && mermaidRef.current) {
        if (!mermaidRef.current.shadowRoot) mermaidRef.current.attachShadow({ mode: 'open' })
        mermaidRef.current.shadowRoot.innerHTML = `<pre style="padding:12px;font-size:11px;color:var(--red)">${artifact.code}</pre>`
      }
    })
    return () => { cancelled = true }
  }, [artifact.id, artifact.code, editMode, isMermaid])

  // Render Mermaid in fullscreen (separate, no shadow DOM — pure SVG string)
  useEffect(() => {
    if (!isMermaid || !fullscreen) return
    if (!artifact.code) return
    let cancelled = false
    getMermaid().then(mermaid => {
      const id = `fs-${artifact.id.slice(0, 8)}-${Date.now()}`
      return mermaid.render(id, artifact.code)
    }).then(({ svg }) => {
      if (!cancelled) {
        setFullscreenSvg(svg)
        setTransformFs({ x: 0, y: 0, scale: 1 })
      }
    }).catch(() => { if (!cancelled) setFullscreenSvg('') })
    return () => { cancelled = true }
  }, [artifact.id, artifact.code, fullscreen, isMermaid])

  // Wheel zoom — normal view (passive: false)
  useEffect(() => {
    if (!isMermaid || editMode) return
    const el = flowWrapRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      const factor = e.deltaY > 0 ? 0.85 : 1.18
      setTransform(t => ({ ...t, scale: Math.max(0.15, Math.min(8, t.scale * factor)) }))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [isMermaid, editMode])

  // Wheel zoom — fullscreen
  useEffect(() => {
    if (!isMermaid || !fullscreen) return
    const el = flowWrapFsRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      const factor = e.deltaY > 0 ? 0.85 : 1.18
      setTransformFs(t => ({ ...t, scale: Math.max(0.15, Math.min(8, t.scale * factor)) }))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [isMermaid, fullscreen])

  // ── Pointer handlers (normal view) ───────────────────────
  function handlePointerDown(e) {
    isDraggingRef.current = true; setIsDragging(true)
    lastPosRef.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function handlePointerMove(e) {
    if (!isDraggingRef.current) return
    const dx = e.clientX - lastPosRef.current.x
    const dy = e.clientY - lastPosRef.current.y
    lastPosRef.current = { x: e.clientX, y: e.clientY }
    setTransform(t => ({ ...t, x: t.x + dx, y: t.y + dy }))
  }
  function handlePointerUp(e) {
    isDraggingRef.current = false; setIsDragging(false)
    e.currentTarget.releasePointerCapture?.(e.pointerId)
  }

  // ── Pointer handlers (fullscreen) ────────────────────────
  function handlePointerDownFs(e) {
    isDraggingFsRef.current = true; setIsDraggingFs(true)
    lastPosFsRef.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function handlePointerMoveFs(e) {
    if (!isDraggingFsRef.current) return
    const dx = e.clientX - lastPosFsRef.current.x
    const dy = e.clientY - lastPosFsRef.current.y
    lastPosFsRef.current = { x: e.clientX, y: e.clientY }
    setTransformFs(t => ({ ...t, x: t.x + dx, y: t.y + dy }))
  }
  function handlePointerUpFs(e) {
    isDraggingFsRef.current = false; setIsDraggingFs(false)
    e.currentTarget.releasePointerCapture?.(e.pointerId)
  }

  // ── Edit handlers ─────────────────────────────────────────
  const updateFlowchartPreview = useCallback((code) => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      getMermaid().then(m =>
        m.render(`edit-${artifact.id.slice(0, 8)}-${Date.now()}`, code)
      ).then(({ svg }) => setPreviewSvg(svg)).catch(() => setPreviewSvg(''))
    }, 400)
  }, [artifact.id])

  function enterEdit() {
    const initial = isDocument ? (artifact.content || '') : (artifact.code || '')
    setDraft(initial)
    setPreviewSvg('')
    setAiEditText('')
    setEditSubMode('code')
    if (isMermaid) updateFlowchartPreview(initial)
    setEditMode(true)
  }
  function cancelEdit() {
    setEditMode(false); setDraft(''); setPreviewSvg(''); setAiEditText('')
    clearTimeout(debounceRef.current)
  }

  function submitAiEdit() {
    const desc = aiEditText.trim()
    if (!desc || !onRequestAiEdit) return
    const currentCode = isDocument ? (artifact.content || '') : (artifact.code || '')
    const codeBlock = currentCode ? t('artifact.currentContent', { code: currentCode }) : ''
    onRequestAiEdit(t('artifact.aiModifyRequest', { title: artifact.title, type: typeLabel, desc, codeBlock }))
    cancelEdit()
  }
  function saveEdit() {
    onUpdate?.(artifact.id, isDocument ? { content: draft } : { code: draft })
    setEditMode(false); setMermaidRendered(false)
    clearTimeout(debounceRef.current)
  }

  function exportSVG() {
    const svg = mermaidRef.current?.shadowRoot?.querySelector('svg')
    if (!svg) return
    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${artifact.title}.svg`; a.click()
    URL.revokeObjectURL(url)
  }

  const mono = { fontFamily: 'var(--mono, monospace)' }

  return (
    <>
      {/* ── Fullscreen overlay ───────────────────────────────────── */}
      {fullscreen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}
          onKeyDown={e => e.key === 'Escape' && setFullscreen(false)}
          tabIndex={-1}
        >
          {/* Fullscreen header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--bg-surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              <Icon size={15} color={info.color} />
              {artifact.title}
              <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: info.bg, color: info.color, fontWeight: 600 }}>{typeLabel}</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {isMermaid && (
                <>
                  <button onClick={() => setTransformFs(s => ({ ...s, scale: s.scale * 1.25 }))} style={iconBtn} title={t('artifact.zoomIn')}><ZoomIn size={15} /></button>
                  <button onClick={() => setTransformFs(s => ({ ...s, scale: s.scale * 0.8 }))} style={iconBtn} title={t('artifact.zoomOut')}><ZoomOut size={15} /></button>
                  <button onClick={() => setTransformFs({ x: 0, y: 0, scale: 1 })} style={iconBtn} title={t('artifact.reset')}><RotateCcw size={15} /></button>
                </>
              )}
              <button onClick={() => setFullscreen(false)} style={{ ...iconBtn, marginLeft: 4 }}><X size={16} /></button>
            </div>
          </div>

          {/* Fullscreen body */}
          <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
            {isMindmap && <MarkmapViewer markdown={artifact.code} minHeight={0} />}
            {isMermaid && (
              <div
                ref={flowWrapFsRef}
                style={{ width: '100%', height: '100%', overflow: 'hidden', cursor: isDraggingFs ? 'grabbing' : 'grab', userSelect: 'none', touchAction: 'none' }}
                onPointerDown={handlePointerDownFs}
                onPointerMove={handlePointerMoveFs}
                onPointerUp={handlePointerUpFs}
              >
                <div style={{ transform: `translate(${transformFs.x}px, ${transformFs.y}px) scale(${transformFs.scale})`, transformOrigin: '0 0' }}>
                  {fullscreenSvg
                    ? <div dangerouslySetInnerHTML={{ __html: fullscreenSvg }} />
                    : <div style={{ padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>{t('artifact.rendering')}</div>
                  }
                </div>
              </div>
            )}
            {isDocument && (
              <div style={{ height: '100%', overflowY: 'auto', padding: '24px 40px' }}>
                <div className="md" style={{ fontSize: 15, lineHeight: 1.8, maxWidth: 800, margin: '0 auto' }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{artifact.content || ''}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Card ─────────────────────────────────────────────────── */}
      <div style={{ marginTop: 12, border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>

        {/* Header */}
        <div style={{ background: info.bg, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
            <Icon size={14} color={info.color} />
            <span>{artifact.title}</span>
            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'rgba(255,255,255,0.8)', color: info.color, fontWeight: 600, border: `1px solid ${info.color}33` }}>
              {typeLabel}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {!editMode && isMermaid && mermaidRendered && (
              <>
                <button onClick={() => setTransform(s => ({ ...s, scale: s.scale * 1.25 }))} style={iconBtn} title={t('artifact.zoomIn')}><ZoomIn size={12} /></button>
                <button onClick={() => setTransform(s => ({ ...s, scale: s.scale * 0.8 }))} style={iconBtn} title={t('artifact.zoomOut')}><ZoomOut size={12} /></button>
                <button onClick={() => setTransform({ x: 0, y: 0, scale: 1 })} style={iconBtn} title={t('artifact.reset')}><RotateCcw size={12} /></button>
                <button onClick={exportSVG} style={iconBtn} title={t('artifact.exportSvg')}><Download size={12} /></button>
              </>
            )}
            {!editMode && (isMindmap || isMermaid || isDocument) && (
              <button onClick={() => setFullscreen(true)} style={iconBtn} title={t('artifact.fullscreen')}><Maximize2 size={12} /></button>
            )}
            {!editMode && onUpdate && (
              <button onClick={enterEdit} style={{ ...actionBtn, marginLeft: 4 }}>
                <Pencil size={11} />{isMermaid ? t('artifact.editCode') : t('artifact.edit')}
              </button>
            )}
            {editMode && (
              <>
                {onRequestAiEdit && !isDocument && (
                  <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)', marginRight: 4 }}>
                    {[['code', t('artifact.codeTab')], ['ai', t('artifact.aiTab')]].map(([mode, label]) => (
                      <button key={mode} onClick={() => setEditSubMode(mode)} style={{
                        fontSize: 10, padding: '3px 8px', cursor: 'pointer', border: 'none',
                        background: editSubMode === mode ? 'var(--accent)' : 'var(--bg-hover)',
                        color: editSubMode === mode ? 'white' : 'var(--text-muted)', fontWeight: editSubMode === mode ? 600 : 400,
                      }}>{label}</button>
                    ))}
                  </div>
                )}
                <button onClick={cancelEdit} style={cancelBtn}><X size={11} /> {t('artifact.cancel')}</button>
                {editSubMode === 'ai'
                  ? <button onClick={submitAiEdit} disabled={!aiEditText.trim()} style={{ ...saveBtn, background: aiEditText.trim() ? 'var(--accent)' : 'var(--bg-hover)', color: aiEditText.trim() ? 'white' : 'var(--text-muted)' }}><Check size={11} /> {t('artifact.sendToAi')}</button>
                  : <button onClick={saveEdit} style={saveBtn}><Check size={11} /> {t('artifact.save')}</button>
                }
              </>
            )}
            {!editMode && onSave && (
              <button onClick={() => onSave(artifact)} style={{ ...actionBtn, marginLeft: 4 }}>{t('artifact.saveToProject')}</button>
            )}
          </div>
        </div>

        {/* Body */}
        <div style={{ background: 'var(--bg-card)', padding: editMode ? 12 : (isDocument ? 16 : 0) }}>

          {/* ── Edit mode: AI request ─────────────────────────────── */}
          {editMode && editSubMode === 'ai' && (
            <div style={{ padding: '12px 0 4px' }}>
              <textarea
                autoFocus
                value={aiEditText}
                onChange={e => setAiEditText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitAiEdit() } if (e.key === 'Escape') cancelEdit() }}
                placeholder={t('artifact.aiEditPlaceholder', { type: typeLabel })}
                rows={4}
                style={{
                  width: '100%', padding: '10px 12px', background: 'var(--bg-input)',
                  border: '1px solid var(--accent)', borderRadius: 8,
                  color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit',
                  lineHeight: 1.65, resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                }}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{t('artifact.aiEditHint')}</div>
            </div>
          )}

          {/* ── Edit mode: code ─────────────────────────────────────── */}
          {editMode && editSubMode === 'code' && (
            <div style={{ display: 'flex', gap: 10, minHeight: 240 }}>
              <textarea
                autoFocus
                value={draft}
                onChange={e => {
                  setDraft(e.target.value)
                  if (isMermaid) updateFlowchartPreview(e.target.value)
                }}
                placeholder={
                  isMindmap  ? t('artifact.mindmapPlaceholder')
                  : isMermaid ? t('artifact.flowchartPlaceholder')
                  : t('artifact.documentPlaceholder')
                }
                style={{
                  flex: 1, padding: '10px 12px',
                  background: 'var(--bg-input)', color: 'var(--text-primary)',
                  border: '1px solid var(--border)', borderRadius: 8,
                  fontSize: (isMermaid || isMindmap) ? 12 : 13,
                  ...(isMermaid || isMindmap ? mono : {}),
                  lineHeight: 1.65, resize: 'none', outline: 'none',
                }}
              />
              <div style={{
                flex: 1, overflow: 'auto',
                background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8,
                ...(isDocument ? { padding: '12px 16px' } : {}),
              }}>
                {isMermaid && (
                  previewSvg
                    ? <div dangerouslySetInnerHTML={{ __html: previewSvg }} style={{ padding: 12 }} />
                    : <div style={{ padding: 12, fontSize: 12, color: 'var(--text-muted)', paddingTop: 24 }}>{t('artifact.previewHint')}</div>
                )}
                {isMindmap && <MarkmapViewer markdown={draft} minHeight={240} />}
                {isDocument && (
                  draft
                    ? <div className="md" style={{ fontSize: 13, lineHeight: 1.75 }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{draft}</ReactMarkdown>
                      </div>
                    : <div style={{ fontSize: 12, color: 'var(--text-muted)', paddingTop: 8 }}>{t('artifact.previewMd')}</div>
                )}
              </div>
            </div>
          )}

          {/* ── View mode: flowchart (Mermaid + pan/zoom) ─────────── */}
          {!editMode && isMermaid && (
            <div style={{ padding: '12px 12px 0' }}>
              <div
                ref={flowWrapRef}
                style={{
                  height: 320, overflow: 'hidden', position: 'relative',
                  cursor: isDragging ? 'grabbing' : 'grab',
                  userSelect: 'none', touchAction: 'none',
                  border: '1px solid var(--border)', borderRadius: 8,
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              >
                <div style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`, transformOrigin: '0 0' }}>
                  <div ref={mermaidRef} />
                </div>
                {!mermaidRendered && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                    {t('artifact.rendering')}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'center', padding: '6px 0 10px', fontSize: 10, color: 'var(--text-muted)' }}>
                {t('artifact.scrollHint')}
              </div>
            </div>
          )}

          {/* ── View mode: mindmap (markmap) ──────────────────────── */}
          {!editMode && isMindmap && (
            <div style={{ height: 380, borderTop: '1px solid var(--border)' }}>
              <MarkmapViewer markdown={artifact.code} minHeight={380} />
            </div>
          )}

          {/* ── View mode: document (ReactMarkdown) ───────────────── */}
          {!editMode && isDocument && (
            artifact.content
              ? <div className="md" style={{ fontSize: 13, lineHeight: 1.75, color: 'var(--text-secondary)' }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{artifact.content}</ReactMarkdown>
                </div>
              : <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  {t('artifact.emptyDoc')}
                </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Button styles ────────────────────────────────────────────────────────────

const iconBtn = {
  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
  padding: '3px 5px', borderRadius: 5, display: 'flex', alignItems: 'center',
  transition: 'color 0.15s',
}
const actionBtn = {
  fontSize: 11, padding: '4px 10px', borderRadius: 7, cursor: 'pointer',
  background: 'var(--bg-hover)', color: 'var(--text-secondary)',
  border: '1px solid var(--border)', fontWeight: 500,
  display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.15s',
}
const cancelBtn = {
  fontSize: 11, padding: '4px 10px', borderRadius: 7, cursor: 'pointer',
  background: 'var(--bg-hover)', color: 'var(--text-muted)',
  border: '1px solid var(--border)',
  display: 'flex', alignItems: 'center', gap: 4,
}
const saveBtn = {
  fontSize: 11, padding: '4px 10px', borderRadius: 7, cursor: 'pointer',
  background: 'var(--accent)', color: 'white',
  border: 'none', fontWeight: 600,
  display: 'flex', alignItems: 'center', gap: 4,
}
