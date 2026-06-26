const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,   // 'darwin' on macOS，供 UI 判断
})
