import { useRef, useState, useEffect } from 'react'
import { Paperclip, Network, GitBranch, FileText, ArrowUp, BookOpen, FolderPlus, Trash2, NotebookPen, Folder } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function InputBar({
  onSend, onFileUpload, disabled, tokenPercent = 0, messageCount = 0,
  onCommand, onNewNote,
}) {
  const { t } = useTranslation()
  const SLASH_COMMANDS = [
    { cmd: 'summary', label: t('inputBar.slashSummary'),  icon: FileText,   desc: t('inputBar.slashSummaryDesc') },
    { cmd: 'memory',  label: t('inputBar.slashMemory'),   icon: BookOpen,   desc: t('inputBar.slashMemoryDesc') },
    { cmd: 'project', label: t('inputBar.slashProject'),  icon: FolderPlus, desc: t('inputBar.slashProjectDesc') },
    { cmd: 'clear',   label: t('inputBar.slashClear'),    icon: Trash2,     desc: t('inputBar.slashClearDesc') },
  ]
  const [text, setText] = useState('')
  const [showSlash, setShowSlash] = useState(false)
  const [outputFormat, setOutputFormat] = useState(null)
  const [slashIndex, setSlashIndex] = useState(0)
  const textareaRef = useRef(null)

  useEffect(() => {
    if (!showSlash) return
    function handleClickOutside(e) {
      if (!e.target.closest('[data-slash-menu]')) setShowSlash(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showSlash])

  const slashQuery = text.startsWith('/') ? text.slice(1).toLowerCase() : ''
  const filteredCommands = showSlash
    ? SLASH_COMMANDS.filter(c =>
        !slashQuery ||
        c.label.includes(slashQuery) ||
        c.desc.includes(slashQuery)
      )
    : []

  function executeSlashCommand(cmd) {
    setShowSlash(false)
    setText('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    onCommand?.(cmd.cmd)
  }

  function handleKeyDown(e) {
    if (showSlash && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSlashIndex(i => (i + 1) % filteredCommands.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSlashIndex(i => (i - 1 + filteredCommands.length) % filteredCommands.length)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        executeSlashCommand(filteredCommands[slashIndex])
        return
      }
      if (e.key === 'Escape') {
        setShowSlash(false)
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  function submit() {
    const trimmed = text.trim()
    if ((!trimmed && !outputFormat) || disabled) return

    let finalText = trimmed
    if (outputFormat === 'mindmap') {
      finalText = trimmed ? `${trimmed}\n${t('inputBar.mindmapPrompt')}` : t('inputBar.mindmapStart')
    } else if (outputFormat === 'flowchart') {
      finalText = trimmed ? `${trimmed}\n${t('inputBar.flowchartPrompt')}` : t('inputBar.flowchartStart')
    }

    onSend(finalText)
    setText('')
    setOutputFormat(null)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  function handleInput(e) {
    const val = e.target.value
    setText(val)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
    if (val.startsWith('/') && val.length <= 20) {
      setShowSlash(true)
      setSlashIndex(0)
    } else {
      setShowSlash(false)
    }
  }

  function handleFileChange(e) {
    const files = Array.from(e.target.files || [])
    files.forEach(file => onFileUpload?.(file))
    e.target.value = ''
  }

  const canSend = !disabled && (!!text.trim() || !!outputFormat) && !showSlash

  return (
    <div style={{
      borderTop: '1px solid var(--border)',
      background: 'var(--bg-surface)',
      padding: '14px 24px 20px',
      flexShrink: 0,
      position: 'relative',
    }}>
      {/* Slash command menu */}
      {showSlash && filteredCommands.length > 0 && (
        <div
          data-slash-menu
          style={{
            position: 'absolute', bottom: '100%', left: 24, right: 24, zIndex: 60,
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 14, padding: 6, marginBottom: 6,
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <div style={{
            fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
            padding: '4px 10px 6px', textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            {t('inputBar.quickCommands')}
          </div>
          {filteredCommands.map((cmd, i) => {
            const Icon = cmd.icon
            const isActive = slashIndex === i
            return (
              <div
                key={cmd.cmd}
                onClick={() => executeSlashCommand(cmd)}
                onMouseEnter={() => setSlashIndex(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 9, cursor: 'pointer',
                  background: isActive ? 'var(--accent-glow)' : 'transparent',
                  transition: 'background 0.12s',
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                  background: isActive ? 'var(--accent)' : 'var(--bg-hover)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.12s',
                }}>
                  <Icon size={13} color={isActive ? 'white' : 'var(--text-muted)'} />
                </div>
                <div>
                  <div style={{
                    fontSize: 13, fontWeight: 600,
                    color: isActive ? 'var(--accent)' : 'var(--text-primary)',
                    letterSpacing: '-0.01em',
                  }}>
                    {cmd.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{cmd.desc}</div>
                </div>
                {isActive && (
                  <div style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-hover)', padding: '2px 6px', borderRadius: 4 }}>
                    Enter
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Tool row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, position: 'relative' }}>
        <label style={toolBtnStyle}>
          <Paperclip size={13} />
          {t('inputBar.file')}
          <input type="file" multiple style={{ display: 'none' }} onChange={handleFileChange} />
        </label>
        <label style={toolBtnStyle}>
          <Folder size={13} />
          {t('inputBar.folder')}
          <input type="file" webkitdirectory="" multiple style={{ display: 'none' }} onChange={handleFileChange} />
        </label>
        <button
          style={{
            ...toolBtnStyle,
            ...(outputFormat === 'mindmap' ? { background: 'var(--accent-glow)', borderColor: 'var(--accent)', color: 'var(--accent)' } : {}),
          }}
          onClick={() => { setOutputFormat(f => f === 'mindmap' ? null : 'mindmap'); textareaRef.current?.focus() }}
        >
          <Network size={13} />
          {t('inputBar.mindmap')}
        </button>
        <button
          style={{
            ...toolBtnStyle,
            ...(outputFormat === 'flowchart' ? { background: 'var(--accent-glow)', borderColor: 'var(--accent)', color: 'var(--accent)' } : {}),
          }}
          onClick={() => { setOutputFormat(f => f === 'flowchart' ? null : 'flowchart'); textareaRef.current?.focus() }}
        >
          <GitBranch size={13} />
          {t('inputBar.flowchart')}
        </button>
        {onNewNote && (
          <button style={toolBtnStyle} onClick={onNewNote}>
            <NotebookPen size={13} />
            {t('inputBar.note')}
          </button>
        )}
      </div>

      {/* Input area */}
      <div
        style={{
          display: 'flex', alignItems: 'flex-end', gap: 10,
          background: 'var(--bg-input)', border: '1px solid var(--border)',
          borderRadius: 14, padding: '10px 14px',
          transition: 'border-color 0.15s',
        }}
        onFocusCapture={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
        onBlurCapture={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
      >
        <textarea
          ref={textareaRef}
          rows={2}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={t('inputBar.placeholder')}
          disabled={disabled}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text-primary)', fontSize: 14, fontFamily: 'inherit',
            resize: 'none', lineHeight: 1.6, maxHeight: 120,
            scrollbarWidth: 'none',
          }}
        />
        <button
          onClick={submit}
          disabled={!canSend}
          style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: canSend ? 'var(--accent)' : 'var(--bg-hover)',
            border: 'none',
            color: canSend ? 'white' : 'var(--text-muted)',
            cursor: canSend ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}
        >
          <ArrowUp size={16} />
        </button>
      </div>

      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
        {messageCount > 0
          ? t('inputBar.messageStats', { count: messageCount, percent: tokenPercent > 0 ? tokenPercent + '%' : '<1%' }) + (tokenPercent > 70 ? t('inputBar.contextWarning') : '')
          : t('inputBar.hint')}
      </div>
    </div>
  )
}

const toolBtnStyle = {
  display: 'flex', alignItems: 'center', gap: 5,
  padding: '6px 11px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--bg-card)',
  color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
  transition: 'all 0.15s',
}
