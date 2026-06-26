import { useEffect, useRef, useState } from 'react'

let cachedModules = null
let cssInjected = false

async function getMarkmapModules() {
  if (cachedModules) return cachedModules
  const [libMod, viewMod] = await Promise.all([
    import('markmap-lib'),
    import('markmap-view'),
  ])
  // Inject markmap CSS once
  if (!cssInjected && viewMod.globalCSS) {
    const style = document.createElement('style')
    style.id = 'markmap-global-css'
    // Override text fill for dark mode compatibility
    style.textContent = viewMod.globalCSS + '\n.markmap text { fill: var(--text-primary, #e2e8f0); }\n.markmap path.markmap-link { stroke-opacity: 0.4; }'
    document.head.appendChild(style)
    cssInjected = true
  }
  cachedModules = {
    Transformer: new libMod.Transformer(),
    Markmap: viewMod.Markmap,
  }
  return cachedModules
}

const COLORS = ['#8875F5', '#06b6d4', '#34d399', '#f59e0b', '#f472b6', '#fb923c']

export default function MarkmapViewer({ markdown, minHeight = 320 }) {
  const svgRef = useRef(null)
  const mmRef = useRef(null)
  const stateRef = useRef(null) // { Transformer, Markmap }
  const [ready, setReady] = useState(false)

  // Initialize on mount
  useEffect(() => {
    let cancelled = false
    getMarkmapModules().then(({ Transformer, Markmap }) => {
      if (cancelled || !svgRef.current) return
      stateRef.current = { Transformer, Markmap }
      const mm = Markmap.create(svgRef.current, {
        zoom: true,
        pan: true,
        duration: 300,
        maxWidth: 200,
        color: (node) => COLORS[node.state.depth % COLORS.length],
        fitRatio: 0.9,
      })
      mmRef.current = mm
      if (markdown) {
        const { root } = Transformer.transform(markdown)
        mm.setData(root)
        requestAnimationFrame(() => {
          if (!cancelled) {
            mm.fit()
            setReady(true)
          }
        })
      } else {
        setReady(true)
      }
    })
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update data when markdown changes
  useEffect(() => {
    if (!mmRef.current || !stateRef.current || !markdown) return
    const { root } = stateRef.current.Transformer.transform(markdown)
    mmRef.current.setData(root)
    requestAnimationFrame(() => mmRef.current?.fit())
  }, [markdown])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mmRef.current) {
        try { mmRef.current.destroy?.() } catch {}
        mmRef.current = null
      }
    }
  }, [])

  return (
    <div style={{ width: '100%', height: '100%', minHeight, position: 'relative' }}>
      {!ready && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, color: 'var(--text-muted)',
        }}>
          渲染中…
        </div>
      )}
      <svg ref={svgRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  )
}
