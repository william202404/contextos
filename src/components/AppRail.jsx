export default function AppRail({ activePage, navigate, onAvatarClick, displayName }) {
  const items = [
    { key: 'overview', icon: '⊞', label: '概览', path: '/' },
    { key: 'skills',   icon: '✦', label: '技能库', path: '/skills' },
  ]
  const bottomItems = [
    { key: 'mcp', icon: '⬡', label: 'MCP', path: '/mcp' },
  ]

  const itemStyle = (key) => ({
    width: 44, minHeight: 44, borderRadius: 10,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 2, cursor: 'pointer', transition: 'all 0.15s',
    border: '1px solid',
    borderColor: activePage === key ? 'var(--accent-border)' : 'transparent',
    background: activePage === key ? 'var(--accent-dim)' : 'transparent',
    color: activePage === key ? 'var(--accent-raw)' : 'var(--text-muted)',
    boxShadow: activePage === key ? '0 0 10px rgba(61,142,245,0.1)' : 'none',
    padding: '6px 4px',
  })

  return (
    <div style={{
      width: 56, background: 'var(--bg-panel)', backdropFilter: 'blur(8px)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '12px 0', gap: 4, flexShrink: 0,
    }}>
      {items.map(item => (
        <div
          key={item.key}
          title={item.label}
          style={itemStyle(item.key)}
          onClick={() => navigate(item.path)}
          onMouseEnter={e => {
            if (activePage !== item.key) {
              e.currentTarget.style.background = 'var(--bg-hover)'
              e.currentTarget.style.color = 'var(--text-secondary)'
            }
          }}
          onMouseLeave={e => {
            if (activePage !== item.key) {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--text-muted)'
            }
          }}
        >
          <span style={{ fontSize: 15, lineHeight: 1 }}>{item.icon}</span>
          <span style={{ fontSize: 8, letterSpacing: '0.02em', lineHeight: 1 }}>{item.label}</span>
        </div>
      ))}

      <div style={{ width: 24, height: 1, background: 'var(--border)', margin: '4px 0' }} />

      {bottomItems.map(item => (
        <div
          key={item.key}
          title={item.label}
          style={itemStyle(item.key)}
          onClick={() => navigate(item.path)}
          onMouseEnter={e => {
            if (activePage !== item.key) {
              e.currentTarget.style.background = 'var(--bg-hover)'
              e.currentTarget.style.color = 'var(--text-secondary)'
            }
          }}
          onMouseLeave={e => {
            if (activePage !== item.key) {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--text-muted)'
            }
          }}
        >
          <span style={{ fontSize: 15, lineHeight: 1 }}>{item.icon}</span>
          <span style={{ fontSize: 8, letterSpacing: '0.02em', lineHeight: 1 }}>{item.label}</span>
        </div>
      ))}

      <div style={{ marginTop: 'auto' }}>
        <div
          onClick={onAvatarClick}
          title="设置"
          style={{
            width: 30, height: 30, borderRadius: 8, cursor: 'pointer',
            background: 'linear-gradient(135deg, var(--accent-raw), var(--cyan))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700, color: 'white', fontFamily: 'var(--font-ui)',
            boxShadow: '0 0 8px rgba(61,142,245,0.25)',
          }}
        >
          {(displayName || 'U').charAt(0).toUpperCase()}
        </div>
      </div>
    </div>
  )
}
