import { useState, useEffect } from 'react'

export default function CreateProjectModal({ suggestedName, suggestedSummary, onConfirm, onCancel, loading }) {
  const [name, setName] = useState(suggestedName || '')
  const [summary, setSummary] = useState(suggestedSummary || '')

  useEffect(() => {
    setName(suggestedName || '')
    setSummary(suggestedSummary || '')
  }, [suggestedName, suggestedSummary])

  function handleConfirm() {
    if (!name.trim()) return
    onConfirm({ name: name.trim(), summary: summary.trim() })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(20, 10, 60, 0.30)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="glass" style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 20, padding: 28, width: 480, maxWidth: '90vw',
        boxShadow: 'var(--shadow-lg)',
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>创建项目</h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 22, lineHeight: 1.5 }}>
          AI 已根据对话自动生成项目名称和摘要，你可以直接编辑。
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>✦</div>
            AI 正在生成项目信息…
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={labelStyle}>项目名称</div>
              <input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="输入项目名称"
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = 'none' }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={labelStyle}>项目摘要</div>
              <textarea
                rows={3}
                value={summary}
                onChange={e => setSummary(e.target.value)}
                placeholder="简短描述这个项目的目标和背景…"
                style={{ ...inputStyle, resize: 'none', lineHeight: 1.6 }}
                onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = 'none' }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }}
              />
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={cancelBtnStyle}>取消</button>
          <button
            onClick={handleConfirm}
            disabled={loading || !name.trim()}
            style={{ ...saveBtnStyle, opacity: loading || !name.trim() ? 0.5 : 1 }}
          >
            创建项目
          </button>
        </div>
      </div>
    </div>
  )
}

const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }
const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 10,
  border: '1px solid var(--border)', background: 'var(--bg-input)',
  color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none',
  transition: 'border-color 0.15s',
}
const cancelBtnStyle = {
  padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 500,
  cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent',
  color: 'var(--text-secondary)',
}
const saveBtnStyle = {
  padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
  cursor: 'pointer', border: 'none',
  background: 'var(--accent)',
  color: 'white',
}
