/**
 * 系统托盘模块 - 支持模型切换
 */
const { Tray, Menu, nativeImage } = require('electron');

// 1x1 透明图标（macOS 用 title 显示 emoji）
const TRANSPARENT_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

// 可用模型列表
const AVAILABLE_MODELS = [
  { key: 'maozi', label: '🎩 帽子原皮' },
  { key: 'qingjiaomao', label: '🫑 青椒变装' },
];

/**
 * 构建菜单模板
 */
function buildMenuTemplate(actions, currentModel) {
  const { onTrigger, onToggleScheduler, onQuit, onResetPosition, onSwitchModel, schedulerEnabled } = actions;

  const modelMenuItems = AVAILABLE_MODELS.map(m => ({
    label: m.label,
    type: 'radio',
    checked: currentModel === m.key,
    click: () => {
      if (currentModel !== m.key) {
        onSwitchModel(m.key);
      }
    },
  }));

  return Menu.buildFromTemplate([
    { label: '🐱 Taro AI Pet', enabled: false },
    { type: 'separator' },
    {
      label: '📸 立即观察桌面',
      click: () => onTrigger(),
    },
    {
      label: schedulerEnabled ? '⏸ 暂停定时观察' : '▶️ 恢复定时观察',
      click: () => onToggleScheduler(!schedulerEnabled),
    },
    { type: 'separator' },
    {
      label: '👗 切换模型',
      submenu: modelMenuItems,
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
}

/**
 * 创建系统托盘
 */
function createTray(actions) {
  const icon = nativeImage.createFromDataURL(TRANSPARENT_ICON);
  const tray = new Tray(icon);
  tray.setTitle('🐱');

  let schedulerEnabled = true;

  function updateMenu() {
    const currentModel = actions.getCurrentModel ? actions.getCurrentModel() : 'maozi';
    const menu = buildMenuTemplate({
      ...actions,
      schedulerEnabled,
      onToggleScheduler: (enabled) => {
        schedulerEnabled = enabled;
        actions.onToggleScheduler(enabled);
        updateMenu();
      },
      onSwitchModel: (key) => {
        actions.onSwitchModel(key);
        updateMenu();
      }
    }, currentModel);
    tray.setContextMenu(menu);
  }

  updateMenu();
  return { tray, updateMenu, getSchedulerEnabled: () => schedulerEnabled, setSchedulerEnabled: (enabled) => schedulerEnabled = enabled };
}

module.exports = { createTray, buildMenuTemplate };
