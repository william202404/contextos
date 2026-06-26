import { useState, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
import { searchAll } from '../store/db'

export default function SearchModal({ onClose, onNavigate }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState({ projects: [], messages: [] })
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  function handleChange(e) {
    const q = e.target.value
    setQuery(q)
    clearTimeout(debounceRef.current)
    if (!q.trim()) { setResults({ projects: [], messages: [] }); return }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      const r = await searchAll(q)
      setResults(r)
      setLoading(false)
    }, 250)
  }

  const hasResults = results.projects.length > 0 || results.messages.length > 0

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      paddingTop: 120,
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 16, width: 560, maxWidth: '90vw',
        boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
      }}>
        {/* Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: `1px solid ${hasResults || loading ? 'var(--border)' : 'transparent'}` }}>
          <Search size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={handleChange}
            placeholder="搜索项目、对话内容…"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 15, color: 'var(--text-primary)', fontFamily: 'inherit' }}
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults({ projects: [], messages: [] }); inputRef.current?.focus() }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
              <X size={14} />
            </button>
          )}
          <kbd style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 5, padding: '2px 6px' }}>ESC</kbd>
        </div>

        {/* Results */}
        {(hasResults || loading) && (
          <div style={{ maxHeight: 420, overflowY: 'auto', padding: '8px 0' }}>
            {loading && !hasResults && (
              <div style={{ padding: '20px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>搜索中…</div>
            )}

            {results.projects.length > 0 && (
              <>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '6px 16px 4px' }}>项目</div>
                {results.projects.map(p => (
                  <div key={p.id} onClick={() => onNavigate(p.id)}
                    style={{ padding: '9px 16px', cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{p.name}</div>
                    {(p.summary || (p.status && p.status !== 'active' && p.status !== 'archived')) && (
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.summary || p.status}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}

            {results.messages.length > 0 && (
              <>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '6px 16px 4px', marginTop: results.projects.length ? 4 : 0 }}>对话内容</div>
                {results.messages.map(m => (
                  <div key={m.id} onClick={() => onNavigate(m.projectId)}
                    style={{ padding: '9px 16px', cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: m.role === 'user' ? 'var(--accent-glow)' : 'var(--green-bg)', color: m.role === 'user' ? 'var(--accent)' : 'var(--green)' }}>
                        {m.role === 'user' ? '我' : 'AI'}
                      </span>
                      {m.projectName && (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.projectName}
                        </span>
                      )}
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }}>
                        {new Date(m.timestamp).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{m.excerpt}</div>
                  </div>
                ))}
              </>
            )}

            {!loading && query && !hasResults && (
              <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                没有找到"<span style={{ color: 'var(--text-primary)' }}>{query}</span>"相关内容
              </div>
            )}
          </div>
        )}

        {!query && (
          <div style={{ padding: '20px 16px', fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center' }}>
            输入关键词搜索项目名称和对话内容
          </div>
        )}
      </div>
    </div>
  )
}
