import { AIConfig, AIProvider, getAIConfig } from './ai-config';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatResponse {
  content: string;
  error?: string;
}

// 主聊天函数 - 通过代理转发
export async function chatWithAI(messages: ChatMessage[]): Promise<ChatResponse> {
  const config = getAIConfig();

  if (!config || !config.apiKey) {
    return {
      content: '',
      error: 'AI 尚未配置。请先配置 API Key。'
    };
  }

  try {
    // 构建代理 URL
    const proxyUrl = `/api/ai-proxy?provider=${config.provider}`;

    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey: config.apiKey,
        model: config.model,
        messages: messages,
        apiUrl: config.apiUrl // 可选的自定义 API 地址
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AI Service] 代理错误:', errorText);

      // 尝试解析 JSON 错误
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.error || errorText);
      } catch {
        throw new Error(errorText || `HTTP ${response.status} 错误`);
      }
    }

    const data = await response.json();

    // 解析不同提供商的响应格式
    let content = '';

    switch (config.provider) {
      case 'gemini':
        content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        break;
      case 'openai':
      case 'deepseek':
      case 'kimi':
        content = data.choices?.[0]?.message?.content || '';
        break;
      case 'minimax':
        content = data.choices?.[0]?.message?.content ||
                 data.choices?.[0]?.text ||
                 data.reply ||
                 '';
        break;
      default:
        content = data.choices?.[0]?.message?.content || data.text || '';
    }

    if (!content) {
      throw new Error('AI 返回空内容，请检查 API Key 或模型配置');
    }

    return { content };

  } catch (error) {
    console.error('[AI Service] Error:', error);

    // 详细的错误处理
    if (error instanceof Error) {
      // 网络错误
      if (error.message.includes('Failed to fetch')) {
        return {
          content: '',
          error: '网络连接失败，无法连接到代理服务器。请检查网络连接后重试。'
        };
      }

      // 配额错误
      if (error.message.includes('429') || error.message.includes('quota') || error.message.includes('exhausted')) {
        return {
          content: '',
          error: 'API 配额已用完或请求过于频繁。\n\n解决方案：\n1. 等待 1 分钟后重试\n2. 切换到其他模型\n3. 检查账户配额'
        };
      }

      // 认证错误
      if (error.message.includes('401') || error.message.includes('Unauthorized') || error.message.includes('invalid')) {
        return {
          content: '',
          error: 'API Key 无效或已过期。\n\n请检查：\n1. API Key 是否正确复制\n2. 是否有多余的空格\n3. 是否需要重新生成 Key'
        };
      }

      // 权限错误
      if (error.message.includes('403') || error.message.includes('Forbidden')) {
        return {
          content: '',
          error: '没有权限访问该 API。\n\n可能原因：\n1. API Key 未激活\n2. 需要完成实名认证\n3. 账户被封禁'
        };
      }

      return {
        content: '',
        error: error.message
      };
    }

    return {
      content: '',
      error: '未知错误，请检查控制台日志'
    };
  }
}
