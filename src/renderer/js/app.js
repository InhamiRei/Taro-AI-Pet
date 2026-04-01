/**
 * Taro AI Pet - 渲染进程主逻辑
 * 负责桌宠动画、交互、拖拽、气泡显示
 */
(function () {
  'use strict';

  // ========== DOM 元素 ==========
  const pet = document.getElementById('pet');
  const petContainer = document.getElementById('pet-container');
  const bubble = document.getElementById('bubble');
  const bubbleText = document.getElementById('bubble-text');
  const effects = document.getElementById('effects');

  // ========== 状态管理 ==========
  let currentState = 'idle';
  let bubbleTimer = null;
  let sleepTimer = null;
  const SLEEP_TIMEOUT = 600000; // 10 分钟无互动进入睡眠

  // ========== 初始化 ==========
  function init() {
    setupDrag();
    setupClickInteraction();
    setupMouseRegion();
    setupIPCListeners();
    resetSleepTimer();

    console.log('[Taro Pet] 渲染进程已启动');
  }

  // ========== 拖拽功能 ==========
  function setupDrag() {
    let isDragging = false;
    let startX, startY;
    let windowX, windowY;

    petContainer.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.screenX;
      startY = e.screenY;

      // 获取当前窗口位置（通过 screen 坐标计算）
      windowX = window.screenX;
      windowY = window.screenY;

      petContainer.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const dx = e.screenX - startX;
      const dy = e.screenY - startY;

      window.taroAPI.moveWindow(windowX + dx, windowY + dy);
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      petContainer.style.cursor = 'grab';
    });
  }

  // ========== 点击交互 ==========
  function setupClickInteraction() {
    petContainer.addEventListener('click', (e) => {
      // 防止拖拽时触发点击
      if (e.detail === 0) return;

      resetSleepTimer();

      // 生成爱心特效
      spawnHearts(3);

      // 点击时发出可爱反应
      const reactions = [
        '喵~ 你摸我干嘛 (=^·ω·^=)',
        '嗯？有事吗主人~ ♡',
        '再摸也不会变大的喵！',
        '呼噜呼噜~ 好舒服喵',
        '喵呜！被发现了！',
      ];
      const text = reactions[Math.floor(Math.random() * reactions.length)];
      showBubble(text);
      setState('happy');
    });

    // 双击触发截图分析
    petContainer.addEventListener('dblclick', () => {
      showBubble('让我看看你在干什么喵~ 🔍');
      window.taroAPI.triggerAnalysis();
    });
  }

  // ========== 鼠标区域检测（透明穿透） ==========
  function setupMouseRegion() {
    // 鼠标进入可交互区域时，取消穿透
    petContainer.addEventListener('mouseenter', () => {
      window.taroAPI.setIgnoreMouseEvents(false);
    });

    petContainer.addEventListener('mouseleave', () => {
      window.taroAPI.setIgnoreMouseEvents(true, { forward: true });
    });

    bubble.addEventListener('mouseenter', () => {
      window.taroAPI.setIgnoreMouseEvents(false);
    });

    bubble.addEventListener('mouseleave', () => {
      window.taroAPI.setIgnoreMouseEvents(true, { forward: true });
    });
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
  }

  // ========== 状态管理 ==========
  function setState(state) {
    currentState = state;
    pet.setAttribute('data-state', state);

    // 清除旧特效
    clearEffects();

    switch (state) {
      case 'happy':
        spawnSparkles(5);
        // 2 秒后回到 idle
        setTimeout(() => {
          if (currentState === 'happy') setState('idle');
        }, 2000);
        break;

      case 'thinking':
        showThinkingDots();
        break;

      case 'sleeping':
        showSleepZzz();
        break;

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
        showBubble('困了... zzZ 💤');
      }
    }, SLEEP_TIMEOUT);
  }

  // ========== 对话气泡 ==========
  function showBubble(text) {
    // 清除之前的计时器
    if (bubbleTimer) {
      clearTimeout(bubbleTimer);
      bubbleTimer = null;
    }

    // 重置气泡
    bubble.classList.remove('hidden', 'fade-out');
    bubbleText.textContent = '';

    // 打字机效果
    let i = 0;
    const typeInterval = setInterval(() => {
      if (i < text.length) {
        bubbleText.textContent += text[i];
        i++;
      } else {
        clearInterval(typeInterval);

        // 显示完成后 6 秒自动隐藏
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

  // 爱心特效
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

  // 星星闪光特效
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

  // 思考中的点点点
  function showThinkingDots() {
    const dots = document.createElement('div');
    dots.className = 'thinking-dots';
    dots.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
    effects.appendChild(dots);
  }

  // 睡觉的 zzZ
  function showSleepZzz() {
    for (let i = 0; i < 3; i++) {
      const zzz = document.createElement('div');
      zzz.className = 'effect-zzz';
      zzz.textContent = 'z';
      effects.appendChild(zzz);
    }
  }

  // ========== 启动 ==========
  window.addEventListener('DOMContentLoaded', init);
})();
