/**
 * 截图模块 - 使用 Electron 原生 desktopCapturer 截取桌面
 */
const { desktopCapturer } = require('electron');

/**
 * 截取屏幕
 * @param {BrowserWindow} petWindow - 桌宠窗口
 * @returns {Promise<string>} Base64 编码的 PNG 图片
 */
async function captureScreen(petWindow) {
  try {
    // 使用 desktopCapturer 获取屏幕源，设置缩略图大小进行自动缩放
    const sources = await desktopCapturer.getSources({ 
      types: ['screen'], 
      thumbnailSize: { width: 1280, height: 800 } 
    });

    if (sources && sources.length > 0) {
      // 默认取第一个屏幕
      const primaryScreen = sources[0];
      const image = primaryScreen.thumbnail;
      
      const size = image.getSize();
      console.log(`[截图] desktopCapturer 完成，尺寸: ${size.width}x${size.height}`);
      
      const base64 = image.toPNG().toString('base64');
      return base64;
    } else {
      throw new Error("未找到可用的屏幕源");
    }
  } catch (err) {
    console.error(`[截图] 失败: ${err.message}`);
    throw err;
  }
}

module.exports = { captureScreen };
