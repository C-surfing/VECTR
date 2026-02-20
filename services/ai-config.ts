// AI模型提供商配置
export type AIProvider = 'gemini' | 'openai' | 'deepseek' | 'kimi' | 'minimax';

export interface AIModel {
  id: string;
  name: string;
  provider: AIProvider;
  description: string;
  defaultModel: string;
  apiKeyPlaceholder: string;
  apiKeyHelpUrl?: string;
}

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
  apiUrl?: string; // 自定义API地址（可选）
}

// 支持的AI模型列表
export const AI_MODELS: AIModel[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    provider: 'gemini',
    description: 'Google的强大AI模型，支持长文本和代码理解',
    defaultModel: 'gemini-2.0-flash',
    apiKeyPlaceholder: '请输入 Gemini API Key',
    apiKeyHelpUrl: 'https://makersuite.google.com/app/apikey'
  },
  {
    id: 'openai',
    name: 'OpenAI GPT',
    provider: 'openai',
    description: 'ChatGPT背后的模型，强大的通用AI能力',
    defaultModel: 'gpt-3.5-turbo',
    apiKeyPlaceholder: '请输入 OpenAI API Key',
    apiKeyHelpUrl: 'https://platform.openai.com/api-keys'
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    provider: 'deepseek',
    description: '国产开源模型，编程和推理能力出色',
    defaultModel: 'deepseek-chat',
    apiKeyPlaceholder: '请输入 DeepSeek API Key',
    apiKeyHelpUrl: 'https://platform.deepseek.com/api_keys'
  },
  {
    id: 'kimi',
    name: 'Kimi (Moonshot)',
    provider: 'kimi',
    description: '月之暗面出品，支持超长上下文',
    defaultModel: 'moonshot-v1-8k',
    apiKeyPlaceholder: '请输入 Kimi API Key',
    apiKeyHelpUrl: 'https://platform.moonshot.cn/console/api-keys'
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    provider: 'minimax',
    description: '国内领先的AI大模型',
    defaultModel: 'abab6.5-chat',
    apiKeyPlaceholder: '请输入 MiniMax API Key',
    apiKeyHelpUrl: 'https://www.minimaxi.com/platform/api-key'
  }
];

// 默认模型
export const DEFAULT_AI_MODEL = 'gemini';

// 本地存储键名
const STORAGE_KEY = 'vectr-ai-config';

// 获取保存的AI配置
export function getAIConfig(): AIConfig | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Error reading AI config:', e);
  }
  return null;
}

// 保存AI配置
export function saveAIConfig(config: AIConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Error saving AI config:', e);
  }
}

// 清除AI配置
export function clearAIConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Error clearing AI config:', e);
  }
}

// 检查是否已配置AI
export function isAIConfigured(): boolean {
  const config = getAIConfig();
  return !!config && !!config.apiKey;
}

// 获取模型详情
export function getAIModel(provider: AIProvider): AIModel | undefined {
  return AI_MODELS.find(m => m.id === provider);
}
