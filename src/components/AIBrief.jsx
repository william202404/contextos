import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const CHIP_STYLE = {
  conclusion: {
    bg: 'rgba(52,211,153,0.07)',
    border: 'rgba(52,211,153,0.2)',
    color: 'var(--green)',
    dot: 'var(--green)',
  },
  decision: {
    bg: 'rgba(251,191,36,0.07)',
    border: 'rgba(251,191,36,0.2)',
    color: 'var(--amber)',
    dot: 'var(--amber)',
  },
  method: {
    bg: 'var(--accent-dim)',
    border: 'var(--accent-border)',
    color: 'var(--accent-raw)',
    dot: 'var(--accent-raw)',
  },
}

export default function AIBrief({ project, msgCount, onSend }) {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const knowledge = Array.isArray(project?.knowledge) ? project.knowledge.slice(-5) : []
  const status = project?.status || ''
  const rounds = Math.floor((msgCount || 0) / 2)

  return (
    <div style={{
      borderBottom: '1px solid var(--border)',
      padding: '22px 26px 18px',
      flexShrink: 0,
      position: 'relative',
      overflow: 'hidden',
      animation: 'brief-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
    }}>
      {/* top glow line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1, pointerEvents: 'none',
        background: 'linear-gradient(90deg, transparent 0%, rgba(61,142,245,0.5) 30%, rgba(34,211,238,0.4) 70%, transparent 100%)',
      }} />
      {/* background micro-glow */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 80, pointerEvents: 'none',
        background: 'linear-gradient(180deg, rgba(61,142,245,0.04) 0%, transparent 100%)',
      }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12, position: 'relative', zIndex: 1 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 9,
          background: 'var(--accent-dim)', border: '1px solid var(--accent-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, flexShrink: 0,
          boxShadow: '0 0 12px rgba(61,142,245,0.12)',
        }}>🧠</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 700, color: 'var(--accent-raw)', letterSpacing: '0.02em' }}>
            {t('brief.title')}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>
            {rounds > 0 ? t('brief.rounds', { count: rounds }) : ''}
            {rounds > 0 && knowledge.length > 0 ? ' · ' : ''}
            {knowledge.length > 0 ? t('brief.knowledge', { count: knowledge.length }) : ''}
            {rounds === 0 && knowledge.length === 0 ? t('brief.noSummary') : ''}
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)',
            cursor: 'pointer', padding: '3px 7px', borderRadius: 4,
            border: '1px solid transparent', background: 'transparent', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
        >{t('brief.collapse')}</button>
      </div>

      {/* Status text */}
      {status && (
        <div style={{
          fontSize: 13, lineHeight: 1.75, color: 'var(--text-primary)',
          marginBottom: 14, position: 'relative', zIndex: 1,
          fontFamily: 'var(--font-body)',
        }}>
          {status}
        </div>
      )}

      {/* Knowledge chips */}
      {knowledge.length > 0 && (
        <div style={{ marginBottom: 16, position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', gap: 14, marginBottom: 8, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>
            {[
              { label: t('brief.concluded'), color: 'var(--green)' },
              { label: t('brief.pending'), color: 'var(--amber)' },
              { label: t('brief.inProgress'), color: 'var(--accent-raw)' },
            ].map(({ label, color }) => (
              <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
                {label}
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {knowledge.map(k => {
              const c = CHIP_STYLE[k.type] || CHIP_STYLE.method
              const text = k.content.length > 36 ? k.content.slice(0, 35) + '…' : k.content
              return (
                <div key={k.id} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 11px', borderRadius: 6,
                  background: c.bg, border: `1px solid ${c.border}`, color: c.color,
                  fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 600,
                  cursor: 'default',
                }}>
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
                  {text}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
        <button
          onClick={() => { onSend(t('brief.continuePrompt')); setDismissed(true) }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 8,
            fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', border: 'none',
            background: 'var(--accent-raw)', color: '#fff',
            boxShadow: '0 2px 12px rgba(61,142,245,0.3)',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#2272E0'; e.currentTarget.style.boxShadow = '0 2px 18px rgba(61,142,245,0.4)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent-raw)'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(61,142,245,0.3)' }}
        >{t('brief.continueBtn')}</button>
        <button
          onClick={() => setDismissed(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 8,
            fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600,
            cursor: 'pointer',
            background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--bg-card)' }}
        >{t('brief.newTopicBtn')}</button>
        <button
          onClick={() => { onSend(t('brief.reviewPrompt')); setDismissed(true) }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 8,
            fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600,
            cursor: 'pointer',
            background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--bg-card)' }}
        >{t('brief.reviewBtn')}</button>
        <button
          onClick={() => setDismissed(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 8,
            fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600,
            cursor: 'pointer',
            background: 'transparent', border: '1px dashed var(--border)', color: 'var(--text-muted)',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
        >{t('brief.customBtn')}</button>
      </div>
    </div>
  )
}
