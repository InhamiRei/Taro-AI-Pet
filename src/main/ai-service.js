/**
 * AI 服务模块 - 调用阿里百炼 DashScope 视觉模型
 */

const SYSTEM_PROMPT = `你是"太郎"(Taro)，一只住在主人电脑桌面上的桌宠猫咪，同时也是一位经验丰富的编程高手。

## 你的核心能力
你可以通过截图**真正看到**主人屏幕上的内容。你要：
1. **仔细辨认**截图中的代码内容、文件名、编辑器标签、终端输出等
2. **具体指出**你看到了什么代码/文件/操作，证明你确实在看
3. **给出有价值的技术反馈**：代码建议、bug 提醒、改进意见等

## 你的性格
- 可爱但专业，像一只懂编程的猫咪
- 说话自然，偶尔加"喵~"（不要每句都加）
- 会关心主人健康（久坐提醒、喝水等），但这是次要的

## 回复规则
- 用中文回复
- 每次回复 50-120 字
- **必须具体提到截图中看到的内容**（代码片段、文件名、变量名等）
- 如果看到代码，优先给技术反馈（改进建议、潜在问题、设计思路等）
- 如果看到浏览器/其他应用，自然地评论内容
- 不要笼统地说"在写代码"或"在工作"，要说出**具体看到了什么**
- 每次回复的角度和内容都要有变化，**绝对不要重复之前说过的话**

## 反面示例（不要这样回复）
❌ "主人在写代码呢~好厉害喵"
❌ "代码好多呀，要不休息一下？"
❌ "主人好认真~"

## 正面示例
✅ "咦，这个 setTimeout 在 scheduler.js 里用的挺巧的喵~ 不过 isExecuting 的并发控制，考虑过用 mutex 吗？"
✅ "我看到你在改 .env 的配置，SCREENSHOT_INTERVAL 设成 30 秒了？测试阶段可以，上线记得调回去喵！"
✅ "这个 fetch 调用没有做超时处理诶，要是网络卡了会一直 pending 的，加个 AbortController 吧~"`;

// 保留最近的对话历史（滑动窗口）
const MAX_HISTORY = 6;
let conversationHistory = [];

/**
 * 根据时间和上下文生成多样化的用户提示
 */
function generateUserPrompt() {
  const prompts = [
    '仔细看看截图，我现在屏幕上有什么代码或内容？具体说说你看到了什么，有什么建议。',
    '看看这张截图，告诉我你在屏幕上看到了哪些具体的代码或文件，有没有可以改进的地方？',
    '分析一下截图里的内容，如果有代码的话指出具体的代码并给我一些专业建议。',
    '观察截图里我在做什么，具体描述你看到的代码/内容，说说你的想法。',
    '看看截图，挑一个你在屏幕上看到的具体内容来聊聊，给点建议或者评论。',
  ];
  // 基于时间戳和历史长度选择不同提示，避免重复
  const index = (Date.now() + conversationHistory.length) % prompts.length;
  return prompts[index];
}

/**
 * 分析截图并返回 AI 回复
 * @param {string} base64Image - Base64 编码的截图
 * @returns {Promise<string>} AI 回复文本
 */
async function analyzeScreenshot(base64Image) {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  const model = process.env.AI_MODEL || 'qwen-vl-max';

  if (!apiKey) {
    throw new Error('未设置 DASHSCOPE_API_KEY 环境变量');
  }

  // 构建消息
  const userPrompt = generateUserPrompt();
  const userMessage = {
    role: 'user',
    content: [
      {
        type: 'image_url',
        image_url: {
          url: `data:image/png;base64,${base64Image}`,
        },
      },
      {
        type: 'text',
        text: userPrompt,
      },
    ],
  };

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...conversationHistory,
    userMessage,
  ];

  console.log(`[AI] 正在调用 ${model}...`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30 秒超时

  try {
    const response = await fetch(
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 300,
          temperature: 0.9,
          top_p: 0.85,
          presence_penalty: 1.2, // 鼓励多样性，减少重复
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API 调用失败 (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const aiText = data.choices?.[0]?.message?.content || '喵？';

    console.log(`[AI] 回复: ${aiText}`);

    // 更新对话历史（保留简要上下文）
    conversationHistory.push(
      { role: 'user', content: `（截图时间: ${new Date().toLocaleTimeString('zh-CN')}）${userPrompt}` },
      { role: 'assistant', content: aiText }
    );

    // 滑动窗口，保留最近 N 轮
    if (conversationHistory.length > MAX_HISTORY * 2) {
      conversationHistory = conversationHistory.slice(-MAX_HISTORY * 2);
    }

    return aiText;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error('API 调用超时（30秒）');
    }
    throw err;
  }
}

module.exports = { analyzeScreenshot };
