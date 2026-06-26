let initialized = false

export async function getMermaid() {
  const { default: mermaid } = await import('mermaid')
  if (!initialized) {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'neutral',
      suppressErrorRendering: true,
    })
    initialized = true
  }
  return mermaid
}
