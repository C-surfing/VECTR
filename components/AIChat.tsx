import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, Loader2, Minimize2, Settings, ExternalLink, Check, AlertCircle, ChevronRight, HelpCircle } from 'lucide-react';
import { 
  AI_MODELS, 
  DEFAULT_AI_MODEL, 
  AIModel, 
  AIProvider, 
  AIConfig,
  getAIConfig, 
  saveAIConfig, 
  isAIConfigured,
  getAIModel
} from '../services/ai-config';
import { chatWithAI, ChatMessage } from '../services/ai-service';
import { getAPIGuide, parseError } from '../services/ai-config-guide';

interface AIChatProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}

const AIChat: React.FC<AIChatProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      content: '你好！我是 VECTR AI 助手。我可以帮你解答技术问题、提供写作建议，或协助你完成文章创作。',
      timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(null);
  
  // 配置表单状态
  const [configForm, setConfigForm] = useState<{
    provider: AIProvider;
    apiKey: string;
    model: string;
    apiUrl: string;
  }>({
    provider: DEFAULT_AI_MODEL as AIProvider,
    apiKey: '',
    model: '',
    apiUrl: ''
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 初始化检查配置
  useEffect(() => {
    const config = getAIConfig();
    const hasConfig = isAIConfigured();
    setConfigured(hasConfig);
    
    // 首次未配置时直接显示配置界面
    if (!hasConfig) {
      setShowConfig(true);
    }
    
    if (config) {
      const model = getAIModel(config.provider);
      setSelectedModel(model || AI_MODELS[0]);
      setConfigForm({
        provider: config.provider,
        apiKey: config.apiKey,
        model: config.model,
        apiUrl: config.apiUrl || ''
      });
    } else {
      // 默认选中 Gemini
      const defaultModel = AI_MODELS.find(m => m.id === DEFAULT_AI_MODEL);
      setSelectedModel(defaultModel || AI_MODELS[0]);
      setConfigForm(prev => ({
        ...prev,
        provider: DEFAULT_AI_MODEL as AIProvider,
        model: defaultModel?.defaultModel || ''
      }));
    }
  }, []);

  // 自动滚动到最新消息
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 打开时聚焦输入框
  useEffect(() => {
    if (isOpen && !isMinimized && configured && !showConfig) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized, configured, showConfig]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    if (!configured) {
      setShowConfig(true);
      return;
    }

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // 转换消息格式
    const chatMessages: ChatMessage[] = messages.slice(1).map(m => ({
      role: m.role === 'model' ? 'assistant' : 'user',
      content: m.content
    }));
    chatMessages.push({ role: 'user', content: userMessage.content });

    const response = await chatWithAI(chatMessages);

    if (response.error) {
      const parsedError = parseError(response.error);
      const errorMessage: Message = {
        role: 'model',
        content: `❌ **${parsedError.cause}**\n\n${parsedError.solution}\n\n原始错误：${response.error}`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    } else {
      const aiMessage: Message = {
        role: 'model',
        content: response.content,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, aiMessage]);
    }

    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSaveConfig = () => {
    if (!configForm.apiKey.trim()) {
      alert('请输入 API Key');
      return;
    }

    const config: AIConfig = {
      provider: configForm.provider,
      apiKey: configForm.apiKey.trim(),
      model: configForm.model || selectedModel?.defaultModel || '',
      apiUrl: configForm.apiUrl.trim() || undefined
    };

    saveAIConfig(config);
    setConfigured(true);
    setShowConfig(false);
    
    // 添加成功提示消息
    setMessages(prev => [...prev, {
      role: 'model',
      content: `配置成功！当前使用模型：${selectedModel?.name}。现在可以开始对话了。`,
      timestamp: Date.now()
    }]);
  };

  const handleModelChange = (model: AIModel) => {
    setSelectedModel(model);
    setConfigForm(prev => ({
      ...prev,
      provider: model.provider,
      model: model.defaultModel
    }));
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed z-[200] transition-all duration-300 ${
      isMinimized 
        ? 'bottom-4 right-4 w-auto' 
        : 'bottom-4 right-4 w-[420px] h-[600px] max-h-[85vh]'
    }`}>
      {isMinimized ? (
        <button
          onClick={() => setIsMinimized(false)}
          className="w-14 h-14 rounded-full bg-gradient-to-r from-cyan-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-900/40 hover:scale-110 transition-transform"
        >
          <Bot className="w-6 h-6 text-white" />
        </button>
      ) : (
        <div className="w-full h-full glass rounded-3xl border border-white/20 shadow-2xl flex flex-col overflow-hidden">
          {/* 头部 */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-white/5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500 flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-sm">VECTR AI 助手</h3>
                <button 
                  onClick={() => setShowConfig(true)}
                  className="text-[10px] opacity-50 hover:opacity-100 hover:text-cyan-400 transition-all flex items-center gap-1"
                >
                  {configured ? (
                    <>
                      {selectedModel?.name || '已配置'} 
                      <span className="text-cyan-400">●</span>
                    </>
                  ) : (
                    <span className="text-yellow-400">未配置，点击设置</span>
                  )}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* 设置按钮 - 更明显 */}
              <button
                onClick={() => setShowConfig(true)}
                className="p-2 bg-white/10 hover:bg-cyan-500/20 rounded-xl transition-colors relative"
                title="AI 设置"
              >
                <Settings className="w-4 h-4 text-cyan-400" />
              </button>
              <button
                onClick={() => setIsMinimized(true)}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                title="最小化"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                title="关闭"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>



          {/* 配置向导界面 */}
          {showConfig ? (
            <div className="flex-1 overflow-y-auto">
              {!showGuide ? (
                // 快速配置界面
                <div className="p-5">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      <Settings className="w-5 h-5 text-cyan-400" />
                      <h3 className="font-bold text-lg">AI 配置</h3>
                    </div>
                    <button
                      onClick={() => setShowGuide(true)}
                      className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                    >
                      <HelpCircle className="w-4 h-4" />
                      查看完整配置指南
                    </button>
                  </div>

                  {!configured && (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-5 flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-yellow-400 mb-1">首次使用需要配置</p>
                        <p className="text-xs opacity-70">请选择 AI 模型并输入对应的 API Key。</p>
                      </div>
                    </div>
                  )}

                  {/* 推荐的模型（国内优先） */}
                  <div className="mb-5">
                    <label className="text-[10px] opacity-50 uppercase tracking-wider mb-2 block">推荐模型（国内访问快）</label>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {AI_MODELS.filter(m => ['deepseek', 'kimi', 'minimax'].includes(m.id)).map((model) => (
                        <button
                          key={model.id}
                          onClick={() => handleModelChange(model)}
                          className={`p-3 rounded-xl border transition-all text-left ${
                            selectedModel?.id === model.id
                              ? 'bg-cyan-500/10 border-cyan-500/50'
                              : 'bg-white/5 border-white/10 hover:border-white/30'
                          }`}
                        >
                          <div className="font-bold text-sm">{model.name}</div>
                          <div className="text-[10px] opacity-50 mt-1">{model.description}</div>
                        </button>
                      ))}
                    </div>
                    
                    <label className="text-[10px] opacity-50 uppercase tracking-wider mb-2 block">其他模型</label>
                    <div className="grid grid-cols-2 gap-2">
                      {AI_MODELS.filter(m => ['gemini', 'openai'].includes(m.id)).map((model) => (
                        <button
                          key={model.id}
                          onClick={() => handleModelChange(model)}
                          className={`p-3 rounded-xl border transition-all text-left ${
                            selectedModel?.id === model.id
                              ? 'bg-cyan-500/10 border-cyan-500/50'
                              : 'bg-white/5 border-white/10 hover:border-white/30'
                          }`}
                        >
                          <div className="font-bold text-sm">{model.name}</div>
                          <div className="text-[10px] opacity-50 mt-1">{model.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* API Key 输入 */}
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[10px] opacity-50 uppercase tracking-wider">API Key</label>
                      {selectedModel && (
                        <button
                          onClick={() => setShowGuide(true)}
                          className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                        >
                          如何获取 {selectedModel.name} API Key?
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <input
                      type="password"
                      value={configForm.apiKey}
                      onChange={(e) => setConfigForm(prev => ({ ...prev, apiKey: e.target.value }))}
                      placeholder={`粘贴 ${selectedModel?.name || ''} API Key...`}
                      className="w-full bg-black/30 border border-white/20 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/50"
                    />
                    {selectedModel?.exampleKey && (
                      <p className="text-[10px] opacity-40 mt-1">
                        格式示例：{selectedModel.exampleKey.substring(0, 15)}...
                      </p>
                    )}
                  </div>

                  {/* 高级选项 */}
                  <details className="mb-5">
                    <summary className="text-[10px] opacity-50 uppercase tracking-wider cursor-pointer py-2">
                      高级选项（可选）
                    </summary>
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className="text-[10px] opacity-50 mb-1 block">模型版本</label>
                        <input
                          type="text"
                          value={configForm.model}
                          onChange={(e) => setConfigForm(prev => ({ ...prev, model: e.target.value }))}
                          placeholder={selectedModel?.defaultModel || ''}
                          className="w-full bg-black/30 border border-white/20 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-cyan-500/50"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] opacity-50 mb-1 block">自定义 API 地址</label>
                        <input
                          type="text"
                          value={configForm.apiUrl}
                          onChange={(e) => setConfigForm(prev => ({ ...prev, apiUrl: e.target.value }))}
                          placeholder="https://api..."
                          className="w-full bg-black/30 border border-white/20 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-cyan-500/50"
                        />
                      </div>
                    </div>
                  </details>

                  {/* 按钮 */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowConfig(false)}
                      className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleSaveConfig}
                      disabled={!configForm.apiKey.trim()}
                      className="flex-1 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 rounded-xl font-bold transition-colors"
                    >
                      保存配置
                    </button>
                  </div>
                </div>
              ) : (
                // 详细配置指南
                <AIConfigGuide 
                  model={selectedModel} 
                  onBack={() => setShowGuide(false)}
                  onSelectModel={handleModelChange}
                />
              )}
            </div>
          ) : (
            <>
              {/* 消息列表 */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {!configured && messages.length === 1 && (
                  <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4 mb-4">
                    <p className="text-sm mb-3">欢迎使用 VECTR AI 助手！</p>
                    <p className="text-xs opacity-70 mb-3">请先配置 AI 模型才能开始对话。我们支持多种国内外主流 AI 模型。</p>
                    <button
                      onClick={() => setShowConfig(true)}
                      className="w-full py-2 bg-cyan-600/30 hover:bg-cyan-600/50 rounded-lg text-sm font-bold transition-colors"
                    >
                      立即配置
                    </button>
                  </div>
                )}

                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-cyan-600/80 text-white rounded-br-md'
                          : 'bg-white/10 text-white/90 rounded-bl-md'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white/10 px-4 py-3 rounded-2xl rounded-bl-md flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm opacity-60">思考中...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* 输入区域 */}
              <div className="p-4 border-t border-white/10 bg-white/5">
                <div className="flex gap-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={configured ? "输入问题..." : "请先配置 AI..."}
                    disabled={!configured}
                    className="flex-1 bg-white/10 border border-white/10 rounded-2xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-cyan-500/50 max-h-24 disabled:opacity-50"
                    rows={1}
                    style={{ minHeight: '44px' }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading || !configured}
                    className="px-4 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 disabled:hover:bg-cyan-600 rounded-2xl transition-colors flex items-center justify-center"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[10px] opacity-30 mt-2 text-center">
                  Enter 发送 · Shift+Enter 换行
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// AI 配置指南子组件
interface AIConfigGuideProps {
  model: AIModel | null;
  onBack: () => void;
  onSelectModel: (model: AIModel) => void;
}

const AIConfigGuide: React.FC<AIConfigGuideProps> = ({ model, onBack, onSelectModel }) => {
  const guide = model ? getAPIGuide(model.id) : null;

  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="flex items-center gap-2 p-4 border-b border-white/10 bg-white/5">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-white/10 rounded-xl transition-colors"
        >
          <ChevronRight className="w-5 h-5 rotate-180" />
        </button>
        <h3 className="font-bold">配置指南</h3>
      </div>

      {/* 模型选择标签 */}
      <div className="flex gap-2 p-4 overflow-x-auto border-b border-white/10">
        {AI_MODELS.map((m) => (
          <button
            key={m.id}
            onClick={() => onSelectModel(m)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
              model?.id === m.id
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'bg-white/5 hover:bg-white/10'
            }`}
          >
            {m.name}
          </button>
        ))}
      </div>

      {/* 指南内容 */}
      <div className="flex-1 overflow-y-auto p-4">
        {guide ? (
          <div className="space-y-5">
            {/* 模型介绍 */}
            <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-4">
              <h4 className="font-bold text-cyan-400 mb-2">{guide.name}</h4>
              <p className="text-sm opacity-80 mb-2">{guide.description}</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 bg-green-500/10 text-green-400 rounded">{guide.freeTier}</span>
                <span className="px-2 py-1 bg-white/10 rounded">{guide.pricing}</span>
              </div>
            </div>

            {/* 获取步骤 */}
            <div>
              <h5 className="text-sm font-bold mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 text-xs">1</span>
                获取 API Key 步骤
              </h5>
              <ol className="space-y-2 text-sm">
                {guide.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 opacity-80">
                    <span className="text-cyan-400 mt-0.5">{i + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* 快速链接 */}
            <div className="flex gap-2">
              <a
                href={guide.getKeyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 rounded-xl text-sm font-bold text-center flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                前往获取 API Key
              </a>
              <a
                href={guide.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm"
              >
                文档
              </a>
            </div>

            {/* 提示 */}
            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4">
              <h5 className="text-sm font-bold text-yellow-400 mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                注意事项
              </h5>
              <ul className="space-y-1 text-xs opacity-70">
                {guide.tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-yellow-400">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 返回配置按钮 */}
            <button
              onClick={onBack}
              className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              我已获取 API Key，去配置
            </button>
          </div>
        ) : (
          <div className="text-center py-10 opacity-50">
            <p>请选择模型查看配置指南</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIChat;
