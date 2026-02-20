import React from 'react';
import { Terminal, Cpu, Globe, MapPin } from 'lucide-react';

const About: React.FC = () => {
  return (
    <div className="space-y-16 animate-fade-in">
      <header className="text-center space-y-6 max-w-3xl mx-auto">
        <div className="relative inline-block">
          <div className="w-32 h-32 md:w-40 md:h-40 rounded-[40px] overflow-hidden border-2 border-cyan-500/30 p-1 glass">
            <img 
              src="https://ocfbitiofnrjdudakqcf.supabase.co/storage/v1/object/public/media/panda.jpg" 
              alt="Avatar" 
              className="w-full h-full object-cover rounded-[36px] bg-cyan-500/10"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=default';
              }}
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
          深大大一学生，这个博客用于记录日常与学习，感兴趣 contact me at <span className="text-cyan-400">2025150146@mails.szu.edu.cn</span>
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
              你好！我是深圳大学的一名大一学生。这个博客是我的数字空间，用于记录日常学习和生活中的点滴。
            </p>
            <p className="opacity-70 leading-relaxed text-base">
              期待在这里与你分享我的成长与探索。
            </p>
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
                   <span className="text-sm font-bold">中国深圳</span>
                 </div>
              </li>
              <li className="flex items-center gap-4 group">
                 <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                   <Globe className="w-5 h-5 text-purple-400" />
                 </div>
                 <div>
                   <span className="block text-[10px] opacity-40 uppercase tracking-widest">Network</span>
                   <span className="text-sm font-bold">github.com/C-surfing</span>
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
              {['C++', 'Python', '...'].map(tech => (
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
