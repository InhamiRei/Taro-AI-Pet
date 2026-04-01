/**
 * Taro AI Pet - 渲染进程主逻辑 (Live2D 版)
 * 负责 Live2D 模型加载、切换、交互、拖拽、气泡显示
 */
(function () {
  'use strict';

  // ========== 模型配置 ==========
  const MODELS = {
    maozi: {
      name: '帽子',
      path: 'models/maozi/帽子.model3.json',
    },
    qingjiaomao: {
      name: '青椒帽',
      path: 'models/qingjiaomao/青椒帽.model3.json',
    },
  };

  // ========== DOM 元素 ==========
  const petContainer = document.getElementById('pet-container');
  const canvas = document.getElementById('live2d-canvas');
  const bubble = document.getElementById('bubble');
  const bubbleText = document.getElementById('bubble-text');
  const effects = document.getElementById('effects');

  // ========== 状态管理 ==========
  let currentState = 'idle';
  let bubbleTimer = null;
  let sleepTimer = null;
  let currentModel = null;
  let currentModelKey = 'maozi'; // 默认模型
  let pixiApp = null;
  const SLEEP_TIMEOUT = 600000; // 10 分钟无互动进入睡眠

  // ========== 初始化 ==========
  async function init() {
    setupMouseRegion();
    setupIPCListeners();
    resetSleepTimer();

    // 获取配置中保存的模型
    try {
      const config = await window.taroAPI.getConfig();
      if (config.currentModel && MODELS[config.currentModel]) {
        currentModelKey = config.currentModel;
      }
    } catch (e) {
      console.warn('[Taro Pet] 获取配置失败，使用默认模型');
    }

    // 初始化 PixiJS
    await initPixi();

    // 加载默认模型
    await loadModel(currentModelKey);

    console.log('[Taro Pet] Live2D 渲染进程已启动');
  }

  // ========== PixiJS 初始化 ==========
  async function initPixi() {
    pixiApp = new PIXI.Application({
      view: canvas,
      width: 420,
      height: 420,
      backgroundAlpha: 0,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      // 必须开启才能用 readPixels 做像素透明检测
      preserveDrawingBuffer: true,
    });
  }

  // ========== 加载 Live2D 模型 ==========
  async function loadModel(modelKey) {
    const modelConfig = MODELS[modelKey];
    if (!modelConfig) {
      console.error('[Taro Pet] 未知模型:', modelKey);
      return;
    }

    try {
      // 添加切换动画
      petContainer.classList.add('switching');

      // 移除旧模型
      if (currentModel) {
        pixiApp.stage.removeChild(currentModel);
        currentModel.destroy();
        currentModel = null;
      }

      // 加载新模型
      const model = await PIXI.live2d.Live2DModel.from(modelConfig.path);
      currentModel = model;
      currentModelKey = modelKey;

      // 设置模型大小和位置
      const canvasW = 420;
      const canvasH = 420;

      // 计算缩放比例让模型适配窗口
      const scaleX = canvasW / model.width;
      const scaleY = canvasH / model.height;
      const scale = Math.min(scaleX, scaleY) * 0.85;

      model.scale.set(scale);
      model.anchor.set(0.5, 0.5);
      model.x = canvasW / 2;
      model.y = canvasH / 2;

      pixiApp.stage.addChild(model);

      // 切换动画完成
      setTimeout(() => {
        petContainer.classList.remove('switching');
        petContainer.classList.add('switching-in');
        setTimeout(() => {
          petContainer.classList.remove('switching-in');
        }, 300);
      }, 100);

      console.log('[Taro Pet] 模型已加载:', modelConfig.name);

      // 保存当前模型到配置
      window.taroAPI.updateConfig({ currentModel: modelKey });

    } catch (err) {
      console.error('[Taro Pet] 模型加载失败:', err);
      petContainer.classList.remove('switching');
      showBubble('(皱眉) 变装失败了...才不是我的问题！');
    }
  }

  // ========== canvas 像素透明度检测 ==========
  function isPixelOpaque(x, y) {
    if (!pixiApp || !pixiApp.renderer) return false;
    const dpr = window.devicePixelRatio || 1;
    const gl = pixiApp.renderer.gl;
    if (!gl) return false;

    const pixelX = Math.floor(x * dpr);
    const pixelY = Math.floor((420 - y) * dpr); // WebGL Y轴翻转

    const pixel = new Uint8Array(4);
    gl.readPixels(pixelX, pixelY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);

    // alpha > 10 认为有内容
    return pixel[3] > 10;
  }

  // ========== 鼠标区域检测（基于像素的透明穿透） ==========
  function setupMouseRegion() {
    let isDragging = false;
    let startX, startY;
    let windowX, windowY;
    let isOverModel = false;

    // 用 document 级别的 mousemove 配合 forward: true 来检测
    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        const dx = e.screenX - startX;
        const dy = e.screenY - startY;
        window.taroAPI.moveWindow(windowX + dx, windowY + dy);
        return;
      }

      // 检查鼠标是否在 canvas 区域内
      const canvasRect = canvas.getBoundingClientRect();
      const relX = e.clientX - canvasRect.left;
      const relY = e.clientY - canvasRect.top;

      const inCanvas = relX >= 0 && relX < canvasRect.width &&
                        relY >= 0 && relY < canvasRect.height;

      if (inCanvas && isPixelOpaque(relX, relY)) {
        if (!isOverModel) {
          isOverModel = true;
          window.taroAPI.setIgnoreMouseEvents(false);
          petContainer.style.cursor = 'grab';
        }
      } else {
        if (isOverModel) {
          isOverModel = false;
          window.taroAPI.setIgnoreMouseEvents(true, { forward: true });
          petContainer.style.cursor = 'default';
        }
      }
    });

    // 鼠标按下 - 开始拖拽
    document.addEventListener('mousedown', (e) => {
      if (!isOverModel) return;

      isDragging = true;
      startX = e.screenX;
      startY = e.screenY;
      windowX = window.screenX;
      windowY = window.screenY;
      petContainer.style.cursor = 'grabbing';
    });

    // 鼠标松开 - 结束拖拽
    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        petContainer.style.cursor = isOverModel ? 'grab' : 'default';
      }
    });

    // 点击 - 只在模型上触发
    document.addEventListener('click', (e) => {
      if (!isOverModel || isDragging) return;

      resetSleepTimer();
      spawnHearts(3);

      const reactions = [
        '(脸红) 笨、笨蛋！突然摸人家干什么！',
        '(撇嘴) 哼，才不是因为你摸我就开心了呢！',
        '(双手抱胸) 喂！不要随便碰我啊！',
        '(偷偷看你) ……再摸一下也不是不可以啦。',
        '(炸毛) 你这家伙到底把我当什么了！',
      ];
      const text = reactions[Math.floor(Math.random() * reactions.length)];
      showBubble(text);
      playRandomMotion();
    });

    // 双击触发截图分析
    document.addEventListener('dblclick', (e) => {
      if (!isOverModel) return;
      showBubble('(皱眉凑近屏幕) 让我看看你在干什么！');
      window.taroAPI.triggerAnalysis();
    });

    // 右键呼出菜单
    document.addEventListener('contextmenu', (e) => {
      if (!isOverModel) return;
      e.preventDefault();
      window.taroAPI.showContextMenu();
    });

    // 气泡区域的鼠标事件
    bubble.addEventListener('mouseenter', () => {
      window.taroAPI.setIgnoreMouseEvents(false);
    });

    bubble.addEventListener('mouseleave', () => {
      if (!isOverModel) {
        window.taroAPI.setIgnoreMouseEvents(true, { forward: true });
      }
    });
  }

  // ========== 播放随机动作 ==========
  function playRandomMotion() {
    if (!currentModel) return;
    try {
      const motionManager = currentModel.internalModel.motionManager;
      const expressionManager = motionManager.expressionManager;
      if (expressionManager && expressionManager.definitions && expressionManager.definitions.length > 0) {
        const randomIdx = Math.floor(Math.random() * expressionManager.definitions.length);
        currentModel.expression(randomIdx);
      }
    } catch (e) {
      console.warn('[Taro Pet] 动作播放失败:', e.message);
    }
  }

  // ========== IPC 监听 ==========
  function setupIPCListeners() {
    // 桌宠状态变化
    window.taroAPI.onPetState((state) => {
      setState(state);
    });

    // AI 回复
    window.taroAPI.onAIResponse((text) => {
      showBubble(text);
      resetSleepTimer();
    });

    // 切换模型
    window.taroAPI.onSwitchModel((modelKey) => {
      if (modelKey !== currentModelKey && MODELS[modelKey]) {
        showBubble('(兴奋) 等一下，让我换个衣服~ ✨');
        loadModel(modelKey);
      }
    });
  }

  // ========== 状态管理 ==========
  function setState(state) {
    currentState = state;
    clearEffects();

    switch (state) {
      case 'happy':
        spawnSparkles(5);
        playRandomMotion();
        setTimeout(() => {
          if (currentState === 'happy') setState('idle');
        }, 2000);
        break;
      case 'thinking':
      case 'sleeping':
      case 'idle':
      default:
        break;
    }
  }

  // ========== 睡眠计时器 ==========
  function resetSleepTimer() {
    if (sleepTimer) clearTimeout(sleepTimer);
    if (currentState === 'sleeping') setState('idle');

    sleepTimer = setTimeout(() => {
      if (currentState === 'idle') {
        setState('sleeping');
        showBubble('(打哈欠) 困了...才不是因为你不理我才打瞌睡的...');
      }
    }, SLEEP_TIMEOUT);
  }

  // ========== 对话气泡 ==========
  function showBubble(text) {
    if (bubbleTimer) {
      clearTimeout(bubbleTimer);
      bubbleTimer = null;
    }

    bubble.classList.remove('hidden', 'fade-out');
    bubbleText.textContent = '';

    let i = 0;
    const typeInterval = setInterval(() => {
      if (i < text.length) {
        bubbleText.textContent += text[i];
        i++;
      } else {
        clearInterval(typeInterval);

        bubbleTimer = setTimeout(() => {
          bubble.classList.add('fade-out');
          setTimeout(() => {
            bubble.classList.add('hidden');
            bubble.classList.remove('fade-out');
          }, 300);
        }, 6000);
      }
    }, 50);
  }

  // ========== 特效系统 ==========
  function clearEffects() {
    effects.innerHTML = '';
  }

  function spawnHearts(count) {
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const heart = document.createElement('div');
        heart.className = 'effect-heart';
        heart.textContent = '❤️';
        heart.style.left = (30 + Math.random() * 100) + 'px';
        heart.style.top = (20 + Math.random() * 40) + 'px';
        effects.appendChild(heart);
        setTimeout(() => heart.remove(), 1200);
      }, i * 150);
    }
  }

  function spawnSparkles(count) {
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const sparkle = document.createElement('div');
        sparkle.className = 'effect-sparkle';
        sparkle.style.left = (10 + Math.random() * 140) + 'px';
        sparkle.style.top = (10 + Math.random() * 80) + 'px';
        effects.appendChild(sparkle);
        setTimeout(() => sparkle.remove(), 800);
      }, i * 100);
    }
  }

  // ========== 启动 ==========
  window.addEventListener('DOMContentLoaded', init);
})();
