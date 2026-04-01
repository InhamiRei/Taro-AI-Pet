/**
 * 截图模块 - 使用 macOS screencapture 命令截取桌面
 */
const { execFile } = require('child_process');
const { app, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

/**
 * 截取屏幕
 * @param {BrowserWindow} petWindow - 桌宠窗口，截图前隐藏
 * @returns {Promise<string>} Base64 编码的 PNG 图片
 */
async function captureScreen(petWindow) {
  const tmpPath = path.join(app.getPath('temp'), `taro-screenshot-${Date.now()}.png`);

  // 隐藏桌宠窗口，避免截到自己
  const wasVisible = petWindow && petWindow.isVisible();
  if (wasVisible) {
    petWindow.hide();
    await sleep(200);
  }

  try {
    // 使用 macOS screencapture 截图（-x 静音）
    await execPromise('screencapture', ['-x', '-t', 'png', tmpPath]);

    // 读取并压缩图片（限制宽度 1280px，减少 API 传输量）
    const image = nativeImage.createFromPath(tmpPath);
    const size = image.getSize();
    let finalImage = image;

    if (size.width > 1280) {
      finalImage = image.resize({ width: 1280 });
    }

    const base64 = finalImage.toPNG().toString('base64');

    // 清理临时文件
    fs.unlinkSync(tmpPath);

    console.log(`[截图] 完成，原始尺寸: ${size.width}x${size.height}`);
    return base64;
  } finally {
    // 恢复桌宠窗口
    if (wasVisible && petWindow) {
      petWindow.showInactive();
    }
  }
}

function execPromise(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, (err, stdout, stderr) => {
      if (err) reject(new Error(`截图失败: ${err.message}`));
      else resolve(stdout);
    });
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { captureScreen };
