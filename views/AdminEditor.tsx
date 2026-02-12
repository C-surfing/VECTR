import React, { useState, useRef } from 'react';
import { DB } from '../services/db';
import { Category, Post } from '../types';
import { GoogleGenAI } from "@google/genai";
import MarkdownContent from '../components/MarkdownContent';
import { Save, Send, Eye, PenTool, Image as ImageIcon, Video, Sparkles, Check, FileUp, FileText, Upload, X, Loader2 } from 'lucide-react';

const CATEGORY_OPTIONS: { name: Category, desc: string }[] = [
  { name: 'CS', desc: '计算机科学与工程' },
  { name: 'TA', desc: '技术美术与视觉工程' },
  { name: '金融', desc: '金融量化与市场逻辑' },
  { name: '数学', desc: '纯粹数学与逻辑建模' },
  { name: '光影艺术', desc: '数字审美与光影交互' },
  { name: 'AI', desc: '人工智能与深度学习' }
];

const AdminEditor: React.FC<{ onNavigate: (view: any) => void }> = ({ onNavigate }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<Category[]>(['CS']);
  const [coverImage, setCoverImage] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [isPreview, setIsPreview] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handlePublish = () => {
    if (!title || !content || selectedCategories.length === 0) return;
    
    const user = DB.getCurrentUser();
    if (!user) return;

    const newPost: Post = {
      id: Math.random().toString(36).substr(2, 9),
      title,
      content,
      excerpt: content.substring(0, 100).replace(/[#*`]/g, '') + '...',
      category: selectedCategories,
      coverImage: coverImage || `https://picsum.photos/seed/${title}/800/400`,
      videoUrl: videoUrl || undefined,
      authorId: user.id,
      authorName: user.username,
      createdAt: Date.now(),
      likes: [],
      views: 0
    };

    DB.savePost(newPost);
    onNavigate('blog');
  };

  const toggleCategory = (cat: Category) => {
    setSelectedCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setContent(text);
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, ' '));
      }
    };
    reader.readAsText(file);
  };

  const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      alert("视频文件超过 20MB，本地存储容量有限，建议使用嵌入链接。");
    }

    setUploadingVideo(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setVideoUrl(base64);
      setUploadingVideo(false);
    };
    reader.onerror = () => {
      setUploadingVideo(false);
      alert("视频读取失败");
    };
    reader.readAsDataURL(file);
  };

  const handleAiImprove = async () => {
    if (!content) return;
    setIsAiLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `你是一位极具未来主义风格的博主，擅长将文字处理得优雅且富有科技感。请优化以下段落，保持其含义不变但增加文学性，并确保数学公式（如果有）使用LaTeX格式包裹：\n\n${content}`,
        config: { thinkingConfig: { thinkingBudget: 0 } }
      });
      if (response.text) {
        setContent(response.text.trim());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in relative">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/10 pb-8">
        <div>
            <h1 className="text-4xl font-orbitron font-bold text-glow">
              创作中心 <span className="text-cyan-400">.editor</span>
            </h1>
            <p className="text-xs opacity-40 mt-2 font-mono uppercase tracking-widest">Constructing digital vectors...</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileImport} 
            accept=".md,.txt" 
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2.5 glass rounded-xl hover:bg-white/10 transition-all flex items-center text-xs font-bold border-cyan-500/20"
          >
            <FileUp className="w-4 h-4 mr-2 text-cyan-400" /> 导入本地 MD
          </button>
          
          <div className="w-px h-6 bg-white/10 hidden md:block mx-2"></div>
          
          <button 
            onClick={() => setIsPreview(!isPreview)}
            className={`px-5 py-2.5 rounded-xl transition-all flex items-center text-sm font-bold border ${
              isPreview ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400' : 'glass hover:bg-white/10'
            }`}
          >
            {isPreview ? <><PenTool className="w-4 h-4 mr-2" /> 返回编辑</> : <><Eye className="w-4 h-4 mr-2" /> 预览全篇</>}
          </button>
          
          <button 
            onClick={handlePublish}
            disabled={selectedCategories.length === 0 || !title}
            className="px-8 py-2.5 bg-gradient-to-r from-cyan-600 to-indigo-600 rounded-xl font-bold hover:scale-105 transition-all shadow-lg shadow-cyan-900/40 flex items-center disabled:opacity-30 disabled:scale-100 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4 mr-2" /> 发布
          </button>
        </div>
      </header>

      {isPreview ? (
        <div className="glass p-8 md:p-16 rounded-[40px] min-h-[60vh] animate-fade-in border border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 blur-[100px] -z-10"></div>
          <div className="flex flex-wrap gap-2 mb-6">
            {selectedCategories.map(cat => (
              <span key={cat} className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-full">
                {cat}
              </span>
            ))}
          </div>
          <h1 className="text-5xl font-bold mb-10 leading-tight">{title || '未命名档案'}</h1>
          <div className="prose-xl">
             <MarkdownContent content={content || '等待注入灵感...'} />
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-12 gap-10">
          {/* Main Editor Area */}
          <div className="lg:col-span-8 space-y-6">
            <input 
              type="text" 
              placeholder="档案标题..." 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-4xl md:text-5xl font-bold bg-transparent border-none focus:outline-none placeholder:opacity-20 transition-all text-glow"
            />
            
            <div className="relative group">
              <textarea 
                placeholder="在此处倾泻你的灵感（支持 Markdown 与 LaTeX $...$ / $$...$$）" 
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full h-[65vh] bg-white/5 border border-white/10 rounded-[32px] p-8 md:p-10 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 resize-none font-mono text-base leading-relaxed transition-all glass hover:bg-white/[0.07]"
              />
              <div className="absolute bottom-8 right-8 flex gap-3">
                 <button 
                  onClick={handleAiImprove}
                  disabled={isAiLoading || !content}
                  className="px-6 py-3 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 rounded-2xl backdrop-blur-xl transition-all flex items-center text-sm font-bold disabled:opacity-30 group"
                >
                  {isAiLoading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 神经网络优化中...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-2 group-hover:rotate-12 transition-transform" /> AI 语义重构</>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Configuration Sidebar */}
          <div className="lg:col-span-4 space-y-8">
            <div className="glass p-8 rounded-[32px] space-y-8 border border-white/10 shadow-xl">
              <h3 className="font-orbitron font-bold border-b border-white/5 pb-4 flex items-center text-sm tracking-widest text-cyan-400">
                CONFIG <span className="ml-auto opacity-20 text-[10px]">VER_2.4.0</span>
              </h3>
              
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] opacity-40 block mb-4 font-bold uppercase tracking-[0.2em]">维度分类 / Categories</label>
                  <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
                    {CATEGORY_OPTIONS.map(opt => (
                      <div 
                        key={opt.name}
                        onClick={() => toggleCategory(opt.name)}
                        className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col gap-1 group ${
                          selectedCategories.includes(opt.name) 
                            ? 'bg-cyan-500/20 border-cyan-500/50' 
                            : 'bg-white/5 border-white/5 hover:border-white/20'
                        }`}
                      >
                        <div className="text-xs font-bold flex items-center justify-between">
                          {opt.name}
                          {selectedCategories.includes(opt.name) && <Check className="w-3 h-3 text-cyan-400" />}
                        </div>
                        <div className="text-[9px] opacity-30 group-hover:opacity-60 transition-opacity">{opt.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] opacity-40 block font-bold uppercase tracking-[0.2em]">多媒体资源 / Media</label>
                  
                  <div className="space-y-3">
                    <div className="relative group">
                      <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30 group-focus-within:text-cyan-400 transition-colors" />
                      <input 
                        type="text" 
                        placeholder="封面图 URL..." 
                        value={coverImage}
                        onChange={(e) => setCoverImage(e.target.value)}
                        className="w-full bg-white/10 border border-white/10 rounded-2xl p-4 pl-12 focus:outline-none focus:bg-white/[0.15] text-xs transition-all"
                      />
                    </div>

                    <div className="p-5 bg-white/5 rounded-3xl border border-white/10 space-y-4">
                        <div className="flex items-center gap-3 mb-2">
                           <Video className="w-4 h-4 text-cyan-400" />
                           <span className="text-xs font-bold">视频模块</span>
                        </div>
                        
                        <div className="relative">
                          <input 
                            type="text" 
                            placeholder="嵌入代码或链接..." 
                            value={videoUrl.startsWith('data:') ? '' : videoUrl}
                            onChange={(e) => setVideoUrl(e.target.value)}
                            className="w-full bg-black/30 border border-white/5 rounded-xl p-3 text-[11px] focus:outline-none focus:border-cyan-500/30 transition-all"
                            disabled={videoUrl.startsWith('data:')}
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <input 
                            type="file" 
                            ref={videoInputRef} 
                            onChange={handleVideoUpload} 
                            accept="video/*" 
                            className="hidden" 
                          />
                          <button 
                            onClick={() => videoInputRef.current?.click()}
                            disabled={uploadingVideo}
                            className={`flex-1 flex items-center justify-center p-3 rounded-xl border text-[11px] font-bold transition-all ${
                              videoUrl.startsWith('data:') 
                                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300' 
                                : 'bg-white/5 border-white/10 hover:bg-white/10'
                            }`}
                          >
                            {uploadingVideo ? (
                                <><Loader2 className="w-3 h-3 mr-2 animate-spin" /> 上传中</>
                            ) : videoUrl.startsWith('data:') ? (
                                <><Check className="w-3 h-3 mr-2" /> 文件就绪</>
                            ) : (
                                <><Upload className="w-3 h-3 mr-2" /> 上传本地视频</>
                            )}
                          </button>
                          
                          {videoUrl && (
                            <button 
                              onClick={() => setVideoUrl('')}
                              className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl hover:bg-red-500/20 transition-all"
                              title="清除媒体"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-white/5 flex items-center justify-between opacity-30 text-[9px] font-mono">
                <span>AUTOSAVE_ACTIVE</span>
                <span>SYNC: {new Date().toLocaleTimeString()}</span>
              </div>
            </div>

            <div className="glass p-8 rounded-[32px] border border-dashed border-white/10 text-center flex flex-col items-center gap-4 group cursor-default">
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                <FileText className="w-6 h-6 opacity-20" />
              </div>
              <p className="text-[10px] opacity-40 uppercase tracking-[0.3em] leading-relaxed px-4">
                Drag and drop your .md archives here to initialize
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminEditor;