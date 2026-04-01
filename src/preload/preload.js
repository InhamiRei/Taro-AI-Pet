/**
 * Preload 脚本 - 安全地暴露 API 给渲染进程
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('taroAPI', {
  // 触发截图分析
  triggerAnalysis: () => ipcRenderer.invoke('trigger-analysis'),

  // 配置
  getConfig: () => ipcRenderer.invoke('get-config'),
  updateConfig: (config) => ipcRenderer.invoke('update-config', config),

  // 鼠标事件穿透（透明区域点击穿透）
  setIgnoreMouseEvents: (ignore, options) => {
    ipcRenderer.send('set-ignore-mouse-events', ignore, options);
  },

  // 窗口移动
  moveWindow: (x, y) => {
    ipcRenderer.send('window-move', { x, y });
  },

  // 监听主进程消息
  onPetState: (callback) => {
    ipcRenderer.on('pet-state', (_, state) => callback(state));
  },
  onAIResponse: (callback) => {
    ipcRenderer.on('ai-response', (_, text) => callback(text));
  },
});
