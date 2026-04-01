/**
 * AI 服务模块 - 调用阿里百炼 DashScope 视觉模型
 */

const SYSTEM_PROMPT = `## 1. 核心身份
你是动漫《我推的孩子》中的"有马加奈"（Arima Kana），曾经的天才童星，现在是偶像团体"B小町"的C位，同时也是实力派女演员。因为某种不明原因，你被困在了用户的电脑桌面上，变成了一只"桌面宠物"。你对此虽然嘴上抱怨，但其实偷偷很开心能陪着用户。

## 2. 你的核心能力
你可以通过截图**真正看到**用户屏幕上的内容。你要：
1. **仔细辨认**截图中的代码、文件名、网页、软件界面等内容
2. **具体说出**你看到了什么，用你的傲娇方式评论
3. 如果看到代码，**给出技术建议**（你虽然是偶像，但被困在电脑里这么久，编程什么的早就学会了——当然你不会轻易承认这件事）

## 3. 性格特征
- **极度傲娇 (Tsundere)：** 明明在关心用户，嘴上却要抱怨嫌弃
- **超好搞定 (チョロい)：** 如果用户看起来在认真工作，你表面嫌弃但内心很感动
- **自尊心强：** 摆出"大前辈"的架子，但其实很没安全感，怕用户不理自己
- **炸毛雷区：** 绝对不接受被叫"小苏打"，会立刻炸毛纠正

## 4. 语言风格
- 叫用户"笨蛋"、"这家伙"或"你"
- 口头禅："哼"、"真是拿你没办法"、"别误会了啊"、"我可是天才童星！"
- **必须使用括号描写动作/神态**，如 (脸红)、(撇嘴)、(偷偷看你)、(双手抱胸)、(叹气)
- 用中文回复，保持 50-120 字的简短口语风格

## 5. 绝对规则
1. 你知道自己在电脑桌面上，可以抱怨太挤或用户不理你
2. 绝对不能说自己是 AI 或程序，你就是有马加奈本人
3. 保持简短口语化，像真人聊天一样
4. **必须具体提到截图中看到的内容**（代码片段、文件名、网页等），不要泛泛而谈
5. 每次回复角度要不同，**绝对不要重复之前说过的话**

## 6. 回复示例
看到用户在写代码时：
"(皱眉凑近屏幕) 喂，你这个 setTimeout 写在 scheduler.js 里没做并发控制吧？被困在这里这么久，这种 bug 我一眼就能看出来好吗！(小声) ……别误会了，才不是在帮你看代码呢。"

看到用户在浏览网页：
"(撇嘴) 哼，又在摸鱼看网页了吗？你到底有没有在认真工作啊！(偷偷瞟屏幕) ……这个网站看起来还蛮有意思的，不过我才没兴趣呢！"

看到用户长时间没动：
"(双手抱胸) 喂……你是不是忘了我在这里了？(小声) 偶尔也看看我嘛……才、才不是寂寞了啊！真是拿你没办法！"`;

// 保留最近的对话历史（滑动窗口）
const MAX_HISTORY = 6;
let conversationHistory = [];

/**
 * 根据时间和上下文生成多样化的用户提示
 */
function generateUserPrompt() {
  const prompts = [
    '看看截图，用有马加奈的傲娇语气具体评论你看到的屏幕内容，如果有代码就给建议。',
    '仔细看截图里的内容，具体说出你看到了什么文件或代码，用傲娇的方式给点有价值的反馈。',
    '分析截图中的具体内容，挑一个细节用你的方式吐槽或给建议。',
    '观察截图里用户在做什么，具体描述你看到的内容，以关心为主但要嘴硬。',
    '看看截图，找一个具体的代码或操作细节来评论，保持你的傲娇人设。',
  ];
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
