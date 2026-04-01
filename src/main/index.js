/**
 * Taro AI Pet - 主进程入口
 * 负责窗口创建、系统托盘、IPC通信、Live2D 模型切换
 */
const { app, BrowserWindow, ipcMain, screen, nativeImage } = require('electron');
const path = require('path');

// 加载环境变量
const envPath = app.isPackaged
  ? path.join(app.getPath('userData'), '.env')
  : path.join(__dirname, '../../.env');
require('dotenv').config({ path: envPath });

const { buildMenuTemplate, createTray } = require('./tray');
const { Scheduler } = require('./scheduler');
const { captureScreen } = require('./screenshot');
const { analyzeScreenshot, generateChatResponse } = require('./ai-service');
const { getConfig, updateConfig } = require('./config');

let mainWindow = null;
let tray = null;
let trayHelper = null;
let scheduler = null;

/**
 * 创建桌宠窗口 - 透明、无边框、置顶
 */
function createPetWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: 420,
    height: 600,
    x: screenWidth - 450,
    y: screenHeight - 630,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // 透明区域点击穿透
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  // 转发渲染进程的控制台日志
  mainWindow.webContents.on('console-message', (_, level, message) => {
    const prefix = ['[渲染 LOG]', '[渲染 WARN]', '[渲染 ERR]'][level] || '[渲染]';
    console.log(prefix, message);
  });

  // 开发模式打开 DevTools
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  return mainWindow;
}

/**
 * 执行一次截图 + AI 分析流程
 */
async function runAnalysis() {
  if (!mainWindow) return;
  try {
    mainWindow.webContents.send('pet-state', 'thinking');
    const base64 = await captureScreen(mainWindow);
    const response = await analyzeScreenshot(base64);
    mainWindow.webContents.send('ai-response', response);
    mainWindow.webContents.send('pet-state', 'happy');
  } catch (err) {
    console.error('[AI分析失败]', err.message);
    mainWindow.webContents.send('pet-state', 'idle');
    mainWindow.webContents.send('ai-response', '喵...出了点小问题，等下再试试 (╥﹏╥)');
  }
}

/**
 * 切换 Live2D 模型
 */
function switchModel(modelKey) {
  if (!mainWindow) return;
  console.log('[Taro Pet] 切换模型:', modelKey);
  updateConfig({ currentModel: modelKey });
  mainWindow.webContents.send('switch-model', modelKey);
}

/**
 * 获取当前模型
 */
function getCurrentModel() {
  const config = getConfig();
  return config.currentModel || 'maozi';
}

/**
 * 设置 IPC 通信
 */
function setupIPC() {
  // 手动触发截图分析
  ipcMain.handle('trigger-analysis', async () => {
    await runAnalysis();
  });

  // 纯文本交互对话
  ipcMain.handle('chat', async (_, text) => {
    if (!mainWindow) return;
    try {
      mainWindow.webContents.send('pet-state', 'thinking');
      const response = await generateChatResponse(text);
      mainWindow.webContents.send('ai-response', response);
      mainWindow.webContents.send('pet-state', 'happy');
      return response;
    } catch (err) {
      console.error('[AI交互失败]', err.message);
      mainWindow.webContents.send('pet-state', 'idle');
      const fallback = '喵...我走神了，再说一遍？ (╥﹏╥)';
      mainWindow.webContents.send('ai-response', fallback);
      return fallback;
    }
  });

  // 获取配置
  ipcMain.handle('get-config', () => getConfig());

  // 更新配置
  ipcMain.handle('update-config', (_, newConfig) => {
    updateConfig(newConfig);
    if (scheduler && newConfig.interval) {
      scheduler.updateInterval(newConfig.interval);
    }
  });

  // 鼠标事件穿透控制（透明区域点击穿透）
  ipcMain.on('set-ignore-mouse-events', (_, ignore, options) => {
    if (mainWindow) {
      mainWindow.setIgnoreMouseEvents(ignore, options || {});
    }
  });

  // 窗口拖拽
  ipcMain.on('window-move', (_, { x, y }) => {
    if (mainWindow) {
      mainWindow.setPosition(x, y);
    }
  });

  // 弹出右键菜单
  ipcMain.on('show-context-menu', (event, animations) => {
    if (!trayHelper || !trayActions) return;
    
    // 获取当前状态
    const schedulerEnabled = trayHelper.getSchedulerEnabled();
    const currentModel = getCurrentModel();
    const win = BrowserWindow.fromWebContents(event.sender);
    
    const menu = buildMenuTemplate({
      ...trayActions,
      schedulerEnabled,
      onToggleScheduler: (enabled) => {
        trayHelper.setSchedulerEnabled(enabled);
        trayActions.onToggleScheduler(enabled);
        trayHelper.updateMenu();
      },
      onSwitchModel: (key) => {
        trayActions.onSwitchModel(key);
        trayHelper.updateMenu();
      },
      animations: animations || null,
      onPlayAnimation: (type, data) => {
        if (win) win.webContents.send('play-animation', { type, data });
      }
    }, currentModel);
    
    // 在当前窗口弹出
    menu.popup({ window: win });
  });
}

// ========== 共享的托盘与菜单操作 ==========
let trayActions = null;

// ========== 应用启动 ==========
app.whenReady().then(() => {
  // macOS 隐藏 Dock 图标
  if (process.platform === 'darwin') {
    app.dock.hide();
  }

  mainWindow = createPetWindow();
  setupIPC();

  // 创建系统托盘
  const config = getConfig();
  trayActions = {
    onTrigger: () => runAnalysis(),
    onToggleScheduler: (enabled) => {
      if (enabled) scheduler.start();
      else scheduler.stop();
    },
    onQuit: () => app.quit(),
    onResetPosition: () => {
      const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
      mainWindow.setPosition(sw - 450, sh - 630);
    },
    onSwitchModel: (modelKey) => {
      switchModel(modelKey);
    },
    getCurrentModel: () => getCurrentModel(),
  };

  trayHelper = createTray(trayActions);
  tray = trayHelper.tray;

  // 启动定时截图
  scheduler = new Scheduler(runAnalysis, config.interval);
  if (config.autoStart) {
    scheduler.start();
  }

  console.log('[Taro Pet] 桌宠已启动! 截图间隔:', config.interval / 1000, '秒');
  console.log('[Taro Pet] 当前模型:', getCurrentModel());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
