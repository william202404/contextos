import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Archive } from 'lucide-react'
import { getProjectStats } from '../store/db'

export default function ProjectCard({ project, onDelete, onArchive }) {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(false)
  const [stats, setStats] = useState({ rounds: null, fileCount: null })

  useEffect(() => {
    getProjectStats(project.id).then(s => setStats(s))
  }, [project.id])

  const displayText = project.status && project.status !== 'active' && project.status !== 'archived'
    ? project.status
    : project.summary

  const TOKEN_WINDOW = 200000
  const tokenPercent = stats?.totalChars != null
    ? Math.min(99, Math.round(stats.totalChars / (TOKEN_WINDOW * 2.5) * 100))
    : 0

  const knowledgeCount = project.knowledge
    ? project.knowledge.split('\n').filter(l => l.trim()).length
    : 0

  const isActive = project.updatedAt && (Date.now() - project.updatedAt < 7 * 24 * 60 * 60 * 1000)

  return (
    <div
      onClick={() => navigate(`/project/${project.id}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'var(--bg-hover)' : 'var(--bg-card)',
        border: `1px solid ${hovered ? 'var(--border-strong)' : 'var(--border)'}`,
        borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7, flexShrink: 0,
          background: 'var(--bg-hover)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
        }}>
          {project.icon || '📁'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {project.name}
          </div>
        </div>
        {hovered ? (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {onArchive && (
              <button
                onClick={e => onArchive(project.id, e)}
                style={{ width: 20, height: 20, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, padding: 0, transition: 'color 0.15s' }}
                onMouseEnter={e => { e.stopPropagation(); e.currentTarget.style.color = 'var(--amber)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
                title="归档项目"
              >
                <Archive size={11} />
              </button>
            )}
            {onDelete && (
              <button
                onClick={e => { e.stopPropagation(); onDelete(project.id) }}
                style={{ width: 20, height: 20, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, fontSize: 11, padding: 0, transition: 'color 0.15s' }}
                onMouseEnter={e => { e.stopPropagation(); e.currentTarget.style.color = 'var(--red)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
                title="删除项目"
              >
                ✕
              </button>
            )}
          </div>
        ) : (
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, flexShrink: 0,
            ...(isActive
              ? { background: 'rgba(52,211,153,0.12)', color: 'var(--green)' }
              : { background: 'rgba(251,191,36,0.12)', color: 'var(--amber)' }),
          }}>
            {isActive ? '进行中' : '暂停'}
          </span>
        )}
      </div>

      {/* Summary */}
      <div style={{
        fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 12, minHeight: 32,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {displayText || <span style={{ color: 'var(--text-muted)' }}>暂无摘要</span>}
      </div>

      {/* Context depth bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, flexShrink: 0 }}>上下文</span>
        <div style={{ flex: 1, height: 3, background: 'var(--bg-hover)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${tokenPercent}%`, background: 'var(--teal)', borderRadius: 2, transition: 'width 0.4s ease' }} />
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--teal)', fontWeight: 600, flexShrink: 0 }}>
          {tokenPercent > 0 ? tokenPercent + '%' : '<1%'}
        </span>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>{stats.rounds ?? '—'}</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>轮</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>{stats.fileCount ?? '—'}</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>文件</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>{knowledgeCount}</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>知识</span>
          </span>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
          {formatTime(project.updatedAt)}
        </span>
      </div>
    </div>
  )
}

function formatTime(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}小时前`
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}天前`
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}
