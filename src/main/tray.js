/**
 * 系统托盘模块
 */
const { Tray, Menu, nativeImage } = require('electron');

// 1x1 透明图标（macOS 用 title 显示 emoji）
const TRANSPARENT_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

/**
 * 创建系统托盘
 */
function createTray({ onTrigger, onToggleScheduler, onQuit, onResetPosition }) {
  const icon = nativeImage.createFromDataURL(TRANSPARENT_ICON);
  const tray = new Tray(icon);
  tray.setTitle('🐱');

  let schedulerEnabled = true;

  function updateMenu() {
    const menu = Menu.buildFromTemplate([
      { label: '🐱 Taro AI Pet', enabled: false },
      { type: 'separator' },
      {
        label: '📸 立即观察桌面',
        click: () => onTrigger(),
      },
      {
        label: schedulerEnabled ? '⏸ 暂停定时观察' : '▶️ 恢复定时观察',
        click: () => {
          schedulerEnabled = !schedulerEnabled;
          onToggleScheduler(schedulerEnabled);
          updateMenu();
        },
      },
      { type: 'separator' },
      {
        label: '📍 重置位置',
        click: () => onResetPosition(),
      },
      { type: 'separator' },
      {
        label: '❌ 退出',
        click: () => onQuit(),
      },
    ]);
    tray.setContextMenu(menu);
  }

  updateMenu();
  return tray;
}

module.exports = { createTray };
