// Extracts readable text/data from various file types for AI context injection

const TEXT_EXTENSIONS = /\.(md|txt|csv|json|js|ts|jsx|tsx|py|html|css|xml|yaml|yml|sql|sh|bash|zsh|go|rs|java|c|cpp|h|rb|swift|kt|vue|svelte|php|toml|env|ini|conf|log|gitignore|prettierrc|eslintrc|babelrc)$/i

const IMAGE_TYPES = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i

export function isTextFile(file) {
  return file.type.startsWith('text/') || TEXT_EXTENSIONS.test(file.name)
}

export function isImageFile(file) {
  return file.type.startsWith('image/') || IMAGE_TYPES.test(file.name)
}

export function isPDF(file) {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
}

export function isWord(file) {
  return /\.(docx|doc)$/i.test(file.name) ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
}

export function isExcel(file) {
  return /\.(xlsx|xls|ods|numbers)$/i.test(file.name) ||
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
}

export function isPPT(file) {
  return /\.(pptx|ppt)$/i.test(file.name) ||
    file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
}

function readAsText(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target.result)
    reader.onerror = () => resolve(null)
    reader.readAsText(file, 'utf-8')
  })
}

function readAsArrayBuffer(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target.result)
    reader.onerror = () => resolve(null)
    reader.readAsArrayBuffer(file)
  })
}

function readAsDataURL(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target.result)
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(file)
  })
}

async function extractPDF(file) {
  try {
    const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist')
    // Use legacy build to avoid worker issues in browser
    GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
    const buffer = await readAsArrayBuffer(file)
    if (!buffer) return null
    const pdf = await getDocument({ data: buffer }).promise
    const pages = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      const text = textContent.items.map(item => item.str).join(' ')
      pages.push(`[第 ${i} 页]\n${text}`)
    }
    return pages.join('\n\n')
  } catch (err) {
    console.warn('PDF 提取失败:', err)
    return null
  }
}

async function extractWord(file) {
  try {
    const mammoth = await import('mammoth')
    const buffer = await readAsArrayBuffer(file)
    if (!buffer) return null
    const result = await mammoth.extractRawText({ arrayBuffer: buffer })
    return result.value || null
  } catch (err) {
    console.warn('Word 提取失败:', err)
    return null
  }
}

async function extractExcel(file) {
  try {
    const XLSX = await import('xlsx')
    const buffer = await readAsArrayBuffer(file)
    if (!buffer) return null
    const wb = XLSX.read(buffer, { type: 'array' })
    const parts = []
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName]
      const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false })
      if (csv.trim()) parts.push(`[Sheet: ${sheetName}]\n${csv}`)
    }
    return parts.join('\n\n') || null
  } catch (err) {
    console.warn('Excel 提取失败:', err)
    return null
  }
}

async function extractPPT(file) {
  // pptx is a ZIP; extract text from slide XML files
  try {
    const { read: xlsxRead } = await import('xlsx')
    // Use JSZip-compatible approach via xlsx's CFB
    const buffer = await readAsArrayBuffer(file)
    if (!buffer) return null

    // Manual ZIP extraction using Uint8Array
    const { default: JSZip } = await import('jszip').catch(() => null)
    if (!JSZip) return null

    const zip = await JSZip.loadAsync(buffer)
    const slideFiles = Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    slideFiles.sort((a, b) => {
      const na = parseInt(a.match(/\d+/)?.[0] || '0')
      const nb = parseInt(b.match(/\d+/)?.[0] || '0')
      return na - nb
    })

    const slides = []
    for (let i = 0; i < slideFiles.length; i++) {
      const xml = await zip.files[slideFiles[i]].async('string')
      // Extract text between <a:t> tags
      const texts = [...xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)].map(m => m[1]).filter(Boolean)
      if (texts.length) slides.push(`[幻灯片 ${i + 1}]\n${texts.join(' ')}`)
    }
    return slides.join('\n\n') || null
  } catch (err) {
    console.warn('PPT 提取失败:', err)
    return null
  }
}

async function extractImage(file) {
  try {
    const dataUrl = await readAsDataURL(file)
    if (!dataUrl) return null
    // Return structured object for vision injection
    const [header, data] = dataUrl.split(',')
    const mediaType = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg'
    return { isImage: true, data, mediaType }
  } catch {
    return null
  }
}

/**
 * Extract content from a file.
 * Returns: { content: string | null, imageData: { data, mediaType } | null }
 */
export async function extractFileContent(file) {
  if (isImageFile(file)) {
    const imageData = await extractImage(file)
    return { content: null, imageData }
  }
  if (isTextFile(file)) {
    const content = await readAsText(file)
    return { content, imageData: null }
  }
  if (isPDF(file)) {
    const content = await extractPDF(file)
    return { content, imageData: null }
  }
  if (isWord(file)) {
    const content = await extractWord(file)
    return { content, imageData: null }
  }
  if (isExcel(file)) {
    const content = await extractExcel(file)
    return { content, imageData: null }
  }
  if (isPPT(file)) {
    const content = await extractPPT(file)
    return { content, imageData: null }
  }
  // Unknown type — attempt as text
  const content = await readAsText(file)
  return { content, imageData: null }
}
