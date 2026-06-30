import { useState } from 'react'
import { X, Sparkles, Plus, Check, Loader } from 'lucide-react'
import { streamMessage, DEFAULT_MODEL } from '../lib/llm'
import { saveProject } from '../store/db'
import { useTranslation } from 'react-i18next'

const DECOMPOSE_SYSTEM = `你是一个目标拆解专家。用户描述一个大目标，你将其拆分为 3-6 个可独立执行的子项目。

严格以 JSON 数组格式返回，每个元素包含：
- name: 项目名称（10字以内，清晰具体）
- summary: 一句话描述要做什么（30字以内）
- icon: 适合的单个 emoji

只输出 JSON 数组，不要有任何 markdown 代码块或额外说明文字。

示例输出：
[{"name":"需求分析","summary":"收集用户需求，整理核心功能清单","icon":"📋"},{"name":"界面设计","summary":"制作交互原型和视觉稿","icon":"🎨"}]`

export default function DecomposeModal({ onClose, onCreated }) {
  const { t } = useTranslation()
  const [goal, setGoal] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | done | error
  const [subProjects, setSubProjects] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [errorMsg, setErrorMsg] = useState('')
  const [creating, setCreating] = useState(false)

  async function handleDecompose() {
    if (!goal.trim() || status === 'loading') return
    setStatus('loading')
    setSubProjects([])
    setSelected(new Set())
    setErrorMsg('')

    let fullText = ''
    await streamMessage({
      model: DEFAULT_MODEL,
      messages: [{ role: 'user', content: goal.trim() }],
      systemPrompt: DECOMPOSE_SYSTEM,
      onChunk: (chunk) => { fullText += chunk },
      onDone: () => {
        try {
          const match = fullText.match(/\[[\s\S]*\]/)
          if (!match) throw new Error('格式异常')
          const items = JSON.parse(match[0])
          if (!Array.isArray(items) || items.length === 0) throw new Error('结果为空')
          setSubProjects(items)
          setSelected(new Set(items.map((_, i) => i)))
          setStatus('done')
        } catch {
          setStatus('error')
          setErrorMsg(t('decompose.retryTip'))
        }
      },
      onError: (e) => {
        setStatus('error')
        setErrorMsg(e?.message?.includes('401') ? t('decompose.apiKeyError') : (e?.message || t('decompose.networkError')))
      },
    })
  }

  function toggleSelect(i) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  async function handleCreate() {
    if (selected.size === 0 || creating) return
    setCreating(true)
    const now = Date.now()
    const toCreate = subProjects.filter((_, i) => selected.has(i))
    for (const p of toCreate) {
      await saveProject({
        id: crypto.randomUUID(),
        name: p.name || t('overview.newProject'),
        status: '',
        knowledge: p.summary ? [{ id: crypto.randomUUID(), content: p.summary, date: new Date().toLocaleDateString('zh-CN'), type: 'conclusion' }] : [],
        icon: p.icon || '📁',
        model: DEFAULT_MODEL,
        createdAt: now,
        updatedAt: now + toCreate.indexOf(p),
      })
    }
    onCreated?.()
    onClose()
  }

  const isDisabled = !goal.trim() || status === 'loading'
  const createDisabled = selected.size === 0 || creating

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}
    >
      <div style={{ background: 'var(--bg-surface)', borderRadius: 18, padding: '28px 32px', width: 560, maxHeight: '82vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)', animation: 'slide-up 0.25s ease-out' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>{t('decompose.title')}</h2>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{t('decompose.subtitle')}</div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', borderRadius: 8, flexShrink: 0 }}>
            <X size={16} />
          </button>
        </div>

        {/* Textarea */}
        <textarea
          value={goal}
          onChange={e => setGoal(e.target.value)}
          placeholder={t('decompose.inputPlaceholder')}
          disabled={status === 'loading'}
          onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleDecompose() }}
          onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
          onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
          style={{
            width: '100%', minHeight: 100, border: '1px solid var(--border)', borderRadius: 10,
            padding: '12px 14px', fontSize: 13.5, fontFamily: 'inherit',
            color: 'var(--text-primary)', background: 'var(--bg-base)',
            resize: 'vertical', outline: 'none', lineHeight: 1.65,
            boxSizing: 'border-box', transition: 'border-color 0.15s',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('decompose.shortcutHint')}</span>
          <button
            onClick={handleDecompose}
            disabled={isDisabled}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: isDisabled ? 'not-allowed' : 'pointer', border: 'none',
              background: isDisabled ? 'var(--bg-hover)' : 'var(--accent)',
              color: isDisabled ? 'var(--text-muted)' : 'white',
              transition: 'all 0.15s',
            }}
          >
            {status === 'loading'
              ? <><Loader size={13} style={{ animation: 'spin 0.9s linear infinite' }} />{t('decompose.decomposing')}</>
              : <><Sparkles size={13} />{t('decompose.aiDecompose')}</>
            }
          </button>
        </div>

        {/* Error */}
        {status === 'error' && (
          <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 10, background: 'var(--red-bg)', border: '1px solid var(--red-border)', fontSize: 12.5, color: 'var(--red)', lineHeight: 1.5 }}>
            ⚠ {errorMsg}
          </div>
        )}

        {/* Results */}
        {status === 'done' && subProjects.length > 0 && (
          <div style={{ marginTop: 22, animation: 'slide-up 0.3s ease-out' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t('decompose.resultTitle', { count: subProjects.length })}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {subProjects.map((p, i) => (
                <div
                  key={i}
                  onClick={() => toggleSelect(i)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                    border: selected.has(i) ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: selected.has(i) ? 'var(--accent-glow)' : 'var(--bg-card)',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                    background: selected.has(i) ? 'var(--accent)' : 'transparent',
                    border: selected.has(i) ? 'none' : '1.5px solid var(--border-strong)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}>
                    {selected.has(i) && <Check size={11} color="white" strokeWidth={3} />}
                  </div>
                  <div style={{ fontSize: 22, flexShrink: 0, lineHeight: 1 }}>{p.icon || '📁'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{p.summary}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('decompose.selected', { selected: selected.size, total: subProjects.length })}</span>
                <button
                  onClick={() => setSelected(prev => prev.size === subProjects.length ? new Set() : new Set(subProjects.map((_, i) => i)))}
                  style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-secondary)' }}
                >
                  {selected.size === subProjects.length ? t('decompose.deselectAll') : t('decompose.selectAll')}
                </button>
              </div>
              <button
                onClick={handleCreate}
                disabled={createDisabled}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 20px', borderRadius: 9, fontSize: 13, fontWeight: 600,
                  cursor: createDisabled ? 'not-allowed' : 'pointer', border: 'none',
                  background: createDisabled ? 'var(--bg-hover)' : 'var(--accent)',
                  color: createDisabled ? 'var(--text-muted)' : 'white',
                  transition: 'all 0.15s',
                }}
              >
                <Plus size={14} />
                {creating ? t('decompose.creating') : t('decompose.createCount', { count: selected.size })}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
