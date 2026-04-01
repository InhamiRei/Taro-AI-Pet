/**
 * 配置管理模块 - 使用 JSON 文件持久化配置
 */
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const CONFIG_FILE = path.join(
  app ? app.getPath('userData') : __dirname,
  'taro-pet-config.json'
);

const DEFAULT_CONFIG = {
  interval: parseInt(process.env.SCREENSHOT_INTERVAL) || 300000, // 默认 5 分钟
  autoStart: true, // 启动时自动开始定时观察
  currentModel: 'maozi', // 默认 Live2D 模型
};

/**
 * 读取配置
 */
function getConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    }
  } catch (err) {
    console.error('[配置] 读取失败，使用默认配置:', err.message);
  }
  return { ...DEFAULT_CONFIG };
}

/**
 * 更新配置
 */
function updateConfig(newConfig) {
  try {
    const current = getConfig();
    const merged = { ...current, ...newConfig };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf-8');
    console.log('[配置] 已保存:', merged);
    return merged;
  } catch (err) {
    console.error('[配置] 保存失败:', err.message);
    return getConfig();
  }
}

module.exports = { getConfig, updateConfig };
