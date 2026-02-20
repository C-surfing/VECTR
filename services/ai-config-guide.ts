// AI 模型配置详细指南
export interface APIGuide {
  provider: string;
  name: string;
  description: string;
  getKeyUrl: string;
  docsUrl: string;
  pricing: string;
  freeTier: string;
  steps: string[];
  tips: string[];
  exampleKey?: string;
}

export const API_GUIDES: APIGuide[] = [
  {
    provider: 'gemini',
    name: 'Google Gemini',
    description: 'Google 的 AI 模型，支持长文本理解',
    getKeyUrl: 'https://makersuite.google.com/app/apikey',
    docsUrl: 'https://ai.google.dev/docs',
    pricing: '免费版有限制，Pro 版按需付费',
    freeTier: '每分钟 60 请求，每天 1500 请求',
    steps: [
      '访问 Google AI Studio (makersuite.google.com)',
      '使用 Google 账号登录',
      '点击左侧菜单 "Get API Key"',
      '点击 "Create API Key" 按钮',
      '复制生成的 API Key（以 AIza 开头）',
      '粘贴到 VECTR AI 设置中'
    ],
    tips: [
      'API Key 格式：AIzaSy...（约 39 位字符）',
      '免费额度用完后会返回 429 错误',
      '建议绑定支付方式以获得更高额度',
      'VECTR 已配置后端代理，无需担心 CORS 问题'
    ],
    exampleKey: 'AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
  },
  {
    provider: 'deepseek',
    name: 'DeepSeek',
    description: '国产开源模型，编程能力出色',
    getKeyUrl: 'https://platform.deepseek.com/api_keys',
    docsUrl: 'https://platform.deepseek.com/docs',
    pricing: '新用户赠送 5000 万 Tokens',
    freeTier: '注册即送 5000 万 Tokens',
    steps: [
      '访问 DeepSeek 开放平台 (platform.deepseek.com)',
      '点击右上角 "登录"，用手机号注册',
      '登录后点击左侧 "API Keys"',
      '点击 "创建 API Key" 按钮',
      '输入名称（如 VECTR），点击创建',
      '复制 API Key（以 sk- 开头）',
      '粘贴到 VECTR AI 设置中'
    ],
    tips: [
      '国内访问速度快',
      'API Key 格式：sk-...（约 35 位字符）',
      '赠送额度用完后按量付费，价格便宜',
      '支持 deepseek-chat 和 deepseek-reasoner 模型',
      'VECTR 已配置后端代理，无需担心网络问题'
    ],
    exampleKey: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
  },
  {
    provider: 'kimi',
    name: 'Kimi (Moonshot)',
    description: '月之暗面出品，支持 200 万字上下文',
    getKeyUrl: 'https://platform.moonshot.cn/console/api-keys',
    docsUrl: 'https://platform.moonshot.cn/docs',
    pricing: '新用户赠送 15 元额度',
    freeTier: '注册赠送 15 元，约 150 万 Tokens',
    steps: [
      '访问 Moonshot 开放平台 (platform.moonshot.cn)',
      '点击 "立即注册"，用手机号注册',
      '完成实名认证（需要身份证）',
      '点击左侧 "API Key 管理"',
      '点击 "新建" 按钮',
      '复制生成的 API Key（以 sk- 开头）',
      '粘贴到 VECTR AI 设置中'
    ],
    tips: [
      '必须完成实名认证才能使用',
      'API Key 格式：sk-...（约 32 位字符）',
      '超长上下文是其最大优势',
      '适合处理长文档和论文'
    ],
    exampleKey: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
  },
  {
    provider: 'openai',
    name: 'OpenAI GPT',
    description: 'ChatGPT 背后的官方 API',
    getKeyUrl: 'https://platform.openai.com/api-keys',
    docsUrl: 'https://platform.openai.com/docs',
    pricing: '按量付费，gpt-3.5-turbo 较便宜',
    freeTier: '新用户可能有 $5 免费额度',
    steps: [
      '访问 OpenAI Platform (platform.openai.com)',
      '注册账号（需要海外手机号验证）',
      '登录后点击左侧 "API keys"',
      '点击 "Create new secret key"',
      '输入名称（可选），点击创建',
      '立即复制 API Key（只显示一次！）',
      '粘贴到 VECTR AI 设置中'
    ],
    tips: [
      '需要海外手机号接收验证码',
      'API Key 格式：sk-...（约 51 位字符）',
      '需要绑定信用卡才能使用',
      '国内访问可能需要代理'
    ],
    exampleKey: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
  },
  {
    provider: 'minimax',
    name: 'MiniMax',
    description: '国内领先的大模型公司',
    getKeyUrl: 'https://www.minimaxi.com/platform/api-key',
    docsUrl: 'https://www.minimaxi.com/document',
    pricing: '新用户赠送 1 亿 Tokens',
    freeTier: '注册赠送 1 亿 Tokens',
    steps: [
      '访问 MiniMax 开放平台 (www.minimaxi.com)',
      '点击右上角 "登录/注册"',
      '使用手机号注册并登录',
      '进入 "API 管理" 页面',
      '点击 "创建 API Key"',
      '复制生成的 API Key',
      '粘贴到 VECTR AI 设置中'
    ],
    tips: [
      '国内访问速度快',
      'API Key 格式较复杂，请完整复制',
      '赠送额度较多，适合长期使用',
      '支持 abab6.5-chat 等多种模型'
    ],
    exampleKey: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...'
  }
];

export function getAPIGuide(provider: string): APIGuide | undefined {
  return API_GUIDES.find(g => g.provider === provider);
}

// 常见错误及解决方案
export const COMMON_ERRORS: Record<string, { cause: string; solution: string }> = {
  '429': {
    cause: '请求太频繁或额度用完',
    solution: '等待 1 分钟后重试，或切换到其他模型'
  },
  '401': {
    cause: 'API Key 无效或已过期',
    solution: '检查 API Key 是否正确复制，重新生成 Key'
  },
  '403': {
    cause: '没有权限访问该模型',
    solution: '检查是否完成了实名认证，或选择其他模型'
  },
  'RESOURCE_EXHAUSTED': {
    cause: '配额已用完',
    solution: '切换到 DeepSeek、Kimi 等其他免费模型'
  },
  'network': {
    cause: '网络连接失败',
    solution: '检查网络连接，国内模型无需代理，国外模型可能需要代理'
  },
  'CORS': {
    cause: '浏览器跨域限制',
    solution: '这是浏览器安全限制，建议配置 API 代理或使用支持 CORS 的模型'
  }
};

export function parseError(error: string): { cause: string; solution: string } {
  if (error.includes('429') || error.includes('RESOURCE_EXHAUSTED') || error.includes('quota')) {
    return COMMON_ERRORS['429'];
  }
  if (error.includes('401') || error.includes('Unauthorized') || error.includes('invalid')) {
    return COMMON_ERRORS['401'];
  }
  if (error.includes('403') || error.includes('Forbidden')) {
    return COMMON_ERRORS['403'];
  }
  if (error.includes('network') || error.includes('fetch') || error.includes('Failed to fetch')) {
    return COMMON_ERRORS['network'];
  }
  if (error.includes('CORS') || error.includes('cross-origin')) {
    return COMMON_ERRORS['CORS'];
  }
  return {
    cause: '未知错误',
    solution: '请检查 API Key 和网络连接，或尝试切换其他模型'
  };
}
