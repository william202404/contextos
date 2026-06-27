import { useState, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Bot, Copy, Check, Pencil, RefreshCw } from 'lucide-react'
import ArtifactCard from './ArtifactCard'
import { MODELS } from '../lib/llm'
import { getUserProfile } from './SettingsModal'
import { useTranslation } from 'react-i18next'

export default function ChatMessage({ message, onSaveArtifact, onArtifactUpdate, onEdit, onRegenerate, onRequestAiEdit }) {
  const { t } = useTranslation()
  const isUser = message.role === 'user'
  const modelInfo = message.model ? MODELS[message.model] : null
  const profile = getUserProfile()
  const userInitial = (profile.name || 'U').charAt(0).toUpperCase()
  const userName = profile.name || t('chatMessage.me')
  const [hovered, setHovered] = useState(false)
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(message.content || '')

  function handleCopy() {
    navigator.clipboard.writeText(message.content || '').then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  function handleEditConfirm() {
    if (editText.trim()) {
      onEdit?.(message.id, editText.trim())
    }
    setEditing(false)
  }

  function handleEditKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEditConfirm() }
    if (e.key === 'Escape') setEditing(false)
  }

  const actionBtnStyle = {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text-muted)',
    padding: '1px 4px', borderRadius: 4, display: 'flex', alignItems: 'center',
    gap: 3, fontSize: 10, transition: 'color 0.15s',
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        gap: 12,
        maxWidth: 820,
        flexDirection: isUser ? 'row-reverse' : 'row',
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        width: isUser ? 'auto' : '100%',
        position: 'relative',
      }}>
      {/* Avatar */}
      <div style={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700,
        ...(isUser
          ? { background: 'var(--accent)', color: 'white', fontSize: 13, border: '1px solid var(--accent-border)' }
          : { background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--accent)' }
        ),
      }}>
        {isUser ? userInitial : <Bot size={16} />}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginBottom: 6, fontSize: 11,
          flexDirection: isUser ? 'row-reverse' : 'row',
          color: 'var(--text-muted)',
        }}>
          <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
            {isUser ? userName : 'ContextOS AI'}
          </span>
          {modelInfo && (
            <span style={{
              fontSize: 10, padding: '1px 6px', borderRadius: 4,
              background: 'var(--accent-glow)', color: 'var(--accent)', fontWeight: 500,
            }}>
              {modelInfo.label}
            </span>
          )}
          <span>{formatTime(message.timestamp)}</span>
          {!isUser && hovered && (
            <>
              <button onClick={handleCopy} title={t('chatMessage.copy')} style={{ ...actionBtnStyle, marginLeft: 4, color: copied ? 'var(--green)' : 'var(--text-muted)' }}>
                {copied ? <><Check size={11} />{t('chatMessage.copied')}</> : <><Copy size={11} />{t('chatMessage.copy')}</>}
              </button>
              {onRegenerate && (
                <button onClick={() => onRegenerate(message.id)} title={t('chatMessage.rerun')} style={actionBtnStyle}>
                  <RefreshCw size={11} />{t('chatMessage.rerun')}
                </button>
              )}
            </>
          )}
          {isUser && hovered && !editing && onEdit && (
            <button onClick={() => { setEditText(message.content || ''); setEditing(true) }} title={t('chatMessage.edit')} style={{ ...actionBtnStyle, marginLeft: 4 }}>
              <Pencil size={11} />{t('chatMessage.edit')}
            </button>
          )}
        </div>

        {/* Bubble */}
        {isUser && editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              autoFocus
              value={editText}
              onChange={e => setEditText(e.target.value)}
              onKeyDown={handleEditKeyDown}
              rows={Math.max(2, editText.split('\n').length)}
              style={{
                width: '100%', background: 'var(--bg-input)', border: '1px solid var(--accent)',
                borderRadius: 12, padding: '10px 14px', fontSize: 14, color: 'var(--text-primary)',
                outline: 'none', resize: 'none', fontFamily: 'inherit', lineHeight: 1.6,
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setEditing(false)} style={{ ...actionBtnStyle, padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}>{t('chatMessage.cancel')}</button>
              <button onClick={handleEditConfirm} style={{ padding: '4px 12px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>{t('chatMessage.resend')}</button>
            </div>
          </div>
        ) : (
          <div style={{
            padding: '12px 16px',
            borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
            fontSize: 15,
            lineHeight: 1.85,
            ...(isUser
              ? {
                  background: 'var(--accent-glow)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }
              : {
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  boxShadow: 'var(--shadow-sm)',
                }
            ),
          }}>
            <MessageContent content={message.content} />

            {message.artifacts?.map((a, i) => (
              <ArtifactCard
                key={i}
                artifact={a}
                onSave={onSaveArtifact}
                onUpdate={onArtifactUpdate
                  ? (artId, changes) => onArtifactUpdate(message.id, artId, changes)
                  : undefined}
                onRequestAiEdit={onRequestAiEdit}
              />
            ))}
          </div>
        )}

        {/* Tool call receipts */}
        {!isUser && message.toolCalls?.length > 0 && (
          <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
            {message.toolCalls.map((tc, i) => (
              <span key={i} style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 5,
                background: 'var(--bg-hover)', border: '1px solid var(--border)',
                color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                🔧 {tc.serverName} · {tc.toolName}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CodeBlock({ children, ...props }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const preRef = useRef(null)
  function handleCopy() {
    const text = preRef.current?.textContent || ''
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <div style={{ position: 'relative' }}>
      <pre ref={preRef} {...props}>{children}</pre>
      <button
        onClick={handleCopy}
        style={{
          position: 'absolute', top: 8, right: 8,
          fontSize: 10, padding: '3px 8px', borderRadius: 5,
          background: 'var(--bg-hover)', border: '1px solid var(--border)',
          color: copied ? 'var(--green)' : 'var(--text-muted)',
          cursor: 'pointer', transition: 'color 0.15s',
        }}
      >
        {copied ? t('chatMessage.copiedCode') : t('chatMessage.copyCode')}
      </button>
    </div>
  )
}

function MessageContent({ content }) {
  if (!content) return null
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ pre: CodeBlock }}>
        {content}
      </ReactMarkdown>
    </div>
  )
}

function formatTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}
