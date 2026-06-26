const { app, BrowserWindow, Menu, shell, session } = require('electron')
const path = require('path')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    vibrancy: 'sidebar',
    visualEffectState: 'active',
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,  // 允许从 file:// 发 HTTP 请求（本地 Ollama/API 直连）
    },
  })

  // 注入 CORS 头，允许直连 SkillHub / Glama（代替 Vite 代理）
  // 给所有响应注入 CORS 头（解决本地 Claude/OpenAI 直连跨域）
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'access-control-allow-origin': ['*'],
        'access-control-allow-headers': ['*'],
        'access-control-allow-methods': ['GET, POST, PUT, DELETE, OPTIONS'],
      },
    })
  })

  // 修改发往本地 Ollama 的请求头，把 Origin 改成同源
  // 这样 Ollama 不会做 CORS 检查，解决 POST/streaming preflight 失败问题
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['http://localhost:11434/*', 'http://127.0.0.1:11434/*'] },
    (details, callback) => {
      const requestHeaders = { ...details.requestHeaders }
      requestHeaders['Origin'] = 'http://localhost:11434'
      requestHeaders['Referer'] = 'http://localhost:11434/'
      callback({ requestHeaders })
    }
  )

  // 阻止在 App 窗口内打开外部链接
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    // win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

function buildMenu() {
  const template = [
    {
      label: 'ContextOS',
      submenu: [
        { label: '关于 ContextOS', role: 'about' },
        { type: 'separator' },
        { label: '设置', accelerator: 'Cmd+,', click: (_, win) => win?.webContents.executeJavaScript('window.__openSettings?.()') },
        { type: 'separator' },
        { label: '退出', accelerator: 'Cmd+Q', role: 'quit' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', accelerator: 'Cmd+Z', role: 'undo' },
        { label: '重做', accelerator: 'Shift+Cmd+Z', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', accelerator: 'Cmd+X', role: 'cut' },
        { label: '复制', accelerator: 'Cmd+C', role: 'copy' },
        { label: '粘贴', accelerator: 'Cmd+V', role: 'paste' },
        { label: '全选', accelerator: 'Cmd+A', role: 'selectAll' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { label: '重新加载', accelerator: 'Cmd+R', role: 'reload' },
        ...(isDev ? [{ label: '开发者工具', accelerator: 'Alt+Cmd+I', role: 'toggleDevTools' }] : []),
        { type: 'separator' },
        { label: '实际大小', role: 'resetZoom' },
        { label: '放大', role: 'zoomIn' },
        { label: '缩小', role: 'zoomOut' },
        { type: 'separator' },
        { label: '全屏', role: 'togglefullscreen' },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { label: '最小化', accelerator: 'Cmd+M', role: 'minimize' },
        { label: '关闭', accelerator: 'Cmd+W', role: 'close' },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(() => {
  buildMenu()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
