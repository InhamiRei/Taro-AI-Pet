# 🐱 Taro AI Pet

一个可爱的 AI 桌宠应用，会定时截图你的桌面并通过阿里百炼视觉模型进行分析，像一只好奇的猫咪一样评论你正在做的事情。

## 功能特性

- 🎨 **可爱的 CSS 猫咪桌宠**，带多种动画状态（待机/开心/思考/睡觉）
- 📸 **定时截图桌面**，发送给 AI 视觉模型分析
- 💬 **对话气泡**，打字机效果显示 AI 回复
- 🖱️ **可拖拽**，透明背景点击穿透
- 🔧 **系统托盘**，方便控制
- ❤️ **互动特效**，点击出爱心，开心出星星

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 配置环境变量
复制 `.env.example` 为 `.env`，填入你的百炼 API Key：
```
DASHSCOPE_API_KEY=sk-your-key-here
SCREENSHOT_INTERVAL=300000   # 截图间隔（毫秒），默认 5 分钟
AI_MODEL=qwen-vl-max         # 视觉模型
```

### 3. 启动应用
```bash
npm start
```

开发模式（带 DevTools）：
```bash
npm run dev
```

## 使用方法

| 操作 | 效果 |
|------|------|
| **拖拽猫咪** | 移动桌宠位置 |
| **单击猫咪** | 触发可爱反应 + 爱心特效 |
| **双击猫咪** | 手动触发截图分析 |
| **系统托盘菜单** | 控制定时观察、重置位置、退出 |

## 项目结构

```
src/
├── main/              # Electron 主进程
│   ├── index.js       # 应用入口
│   ├── screenshot.js  # 截图模块
│   ├── ai-service.js  # 百炼 API 调用
│   ├── tray.js        # 系统托盘
│   ├── scheduler.js   # 定时调度器
│   └── config.js      # 配置管理
├── preload/
│   └── preload.js     # 安全的 IPC 桥接
└── renderer/          # 渲染进程（桌宠 UI）
    ├── index.html
    ├── css/style.css  # 样式和动画
    └── js/app.js      # 交互逻辑
```

## 注意事项

- ⚡ macOS 首次运行需要授予「屏幕录制」权限（系统偏好设置 > 隐私与安全性）
- 🔒 截图会发送到阿里云百炼 API，请注意隐私
- 🐱 后续计划接入 Live2D 替换 CSS 猫咪

## License

MIT
