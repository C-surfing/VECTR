import React from 'react';
import { Terminal, Cpu, Code, Brain, Globe, MapPin, Coffee, Rocket } from 'lucide-react';

const About: React.FC = () => {
  return (
    <div className="space-y-16 animate-fade-in">
      <header className="text-center space-y-6 max-w-3xl mx-auto">
        <div className="relative inline-block">
          <div className="w-32 h-32 md:w-40 md:h-40 rounded-[40px] overflow-hidden border-2 border-cyan-500/30 p-1 glass">
            <img 
              src="https://api.dicebear.com/7.x/bottts-neutral/svg?seed=C-surfing" 
              alt="Avatar" 
              className="w-full h-full object-cover rounded-[36px] bg-cyan-500/10"
            />
          </div>
          <div className="absolute -bottom-2 -right-2 glass px-4 py-1.5 rounded-full border border-white/10 flex items-center space-x-2 shadow-xl">
             <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></div>
             <span className="text-[10px] font-bold uppercase tracking-widest text-green-400">Online</span>
          </div>
        </div>
        
        <h1 className="text-5xl font-orbitron font-bold text-glow uppercase tracking-tighter">
          About Me <span className="text-cyan-500">.profile</span>
        </h1>
        <p className="text-lg opacity-60 font-light leading-relaxed">
          Hello, 我是 <span className="text-cyan-400 font-bold">C-surfing</span>。一名正在探索代码逻辑与艺术审美边界的数字游民。
        </p>
      </header>

      <div className="grid md:grid-cols-12 gap-8">
        {/* Main Bio Card */}
        <div className="md:col-span-8 glass p-8 md:p-12 rounded-[40px] border border-white/5 space-y-8">
          <section className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center font-orbitron">
              <Terminal className="mr-3 text-cyan-400" /> MISSION_LOG
            </h2>
            <p className="opacity-70 leading-relaxed text-base">
              在 0 与 1 的海洋中航行，我热衷于挖掘技术背后的人文温度。这个博客是我在数字世界中的矢量基准点，用于记录关于 <span className="text-indigo-400 font-bold">计算机图形学</span>、<span className="text-purple-400 font-bold">数学建模</span> 以及 <span className="text-cyan-400 font-bold">AI 演进</span> 的点滴。
            </p>
            <p className="opacity-70 leading-relaxed text-base">
              我坚信，好的技术应当像“双影奇境”般梦幻而严谨——既有深邃的逻辑支撑，又有灵动的视觉表现。
            </p>
          </section>

          <section className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center font-orbitron">
              <Coffee className="mr-3 text-cyan-400" /> CURRENT_STATUS
            </h2>
            <div className="grid gap-4">
              <div className="bg-white/5 p-6 rounded-3xl border border-white/5 flex items-start gap-4 hover:border-cyan-500/20 transition-colors">
                <Rocket className="w-6 h-6 text-cyan-400 shrink-0" />
                <div>
                   <h4 className="font-bold text-sm mb-1 uppercase tracking-widest">正在进行的项目</h4>
                   <p className="text-sm opacity-50">自研轻量级物理渲染引擎核心，尝试将 WebGPU 与路径追踪结合。</p>
                </div>
              </div>
              <div className="bg-white/5 p-6 rounded-3xl border border-white/5 flex items-start gap-4 hover:border-purple-500/20 transition-colors">
                <Brain className="w-6 h-6 text-purple-400 shrink-0" />
                <div>
                   <h4 className="font-bold text-sm mb-1 uppercase tracking-widest">学习中的领域</h4>
                   <p className="text-sm opacity-50">Transformer 架构下的注意力机制可视化，以及它在金融时序预测中的应用。</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Sidebar Cards */}
        <div className="md:col-span-4 space-y-8">
          <div className="glass p-8 rounded-[40px] border border-white/5 space-y-6">
            <h3 className="text-xs font-bold uppercase tracking-[0.3em] opacity-30 border-b border-white/5 pb-4">Info_Board</h3>
            <ul className="space-y-6">
              <li className="flex items-center gap-4 group">
                 <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                   <MapPin className="w-5 h-5 text-cyan-400" />
                 </div>
                 <div>
                   <span className="block text-[10px] opacity-40 uppercase tracking-widest">Location</span>
                   <span className="text-sm font-bold">Shanghai / Digital Space</span>
                 </div>
              </li>
              <li className="flex items-center gap-4 group">
                 <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                   <Globe className="w-5 h-5 text-purple-400" />
                 </div>
                 <div>
                   <span className="block text-[10px] opacity-40 uppercase tracking-widest">Network</span>
                   <span className="text-sm font-bold">github.com/c-surfing</span>
                 </div>
              </li>
            </ul>
          </div>

          <div className="glass p-8 rounded-[40px] border border-white/5 space-y-6 overflow-hidden relative">
            <div className="absolute -right-4 -bottom-4 opacity-[0.05] rotate-12">
               <Cpu className="w-32 h-32" />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-[0.3em] opacity-30">Tech_Stack</h3>
            <div className="flex flex-wrap gap-2">
              {['React', 'TypeScript', 'WebGPU', 'Python', 'PyTorch', 'Rust', 'Three.js'].map(tech => (
                <span key={tech} className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold uppercase tracking-widest">
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;