const DANGEROUS_TAGS = new Set(['script', 'foreignobject', 'iframe', 'object', 'embed'])
const URL_ATTRS = new Set(['href', 'xlink:href'])

export function sanitizeSvg(svg) {
  if (!svg || typeof DOMParser === 'undefined') return ''
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  if (doc.querySelector('parsererror')) return ''

  for (const node of [...doc.querySelectorAll('*')]) {
    if (DANGEROUS_TAGS.has(node.tagName.toLowerCase())) {
      node.remove()
      continue
    }
    for (const attr of [...node.attributes]) {
      const name = attr.name.toLowerCase()
      const value = attr.value.trim().toLowerCase()
      if (name.startsWith('on') || (URL_ATTRS.has(name) && value.startsWith('javascript:'))) {
        node.removeAttribute(attr.name)
      }
    }
  }

  return doc.documentElement?.outerHTML || ''
}
