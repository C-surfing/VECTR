
import React from 'react';
import { DB } from '../services/db';
import { ExternalLink, UserPlus } from 'lucide-react';

const Friends: React.FC = () => {
  const friends = DB.getFriends();

  return (
    <div className="space-y-12">
      <header className="text-center space-y-4 max-w-2xl mx-auto">
        <h1 className="text-4xl font-orbitron font-bold">友链 <span className="text-cyan-400">.links</span></h1>
        <p className="opacity-60 font-light">
          万千星辰中，总会有交织的轨迹。在这里，我们遇见志同道合的旅伴。
        </p>
      </header>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {friends.map(friend => (
          <a 
            key={friend.id} 
            href={friend.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="glass group p-6 rounded-2xl border border-white/5 hover:border-cyan-500/50 hover:bg-white/5 transition-all duration-500 block relative overflow-hidden"
          >
            <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-10 transition-opacity">
              <ExternalLink className="w-24 h-24" />
            </div>
            
            <div className="flex items-center space-x-4 mb-6">
              <div className="relative">
                <img src={friend.avatar} className="w-16 h-16 rounded-2xl object-cover ring-2 ring-white/5 group-hover:ring-cyan-500/50 transition-all" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-[#0a0a1a]" />
              </div>
              <div>
                <h3 className="text-lg font-bold group-hover:text-cyan-300 transition-colors">{friend.name}</h3>
                <span className="text-xs opacity-40">{new URL(friend.url).hostname}</span>
              </div>
            </div>
            <p className="text-sm opacity-60 leading-relaxed mb-4">{friend.description}</p>
            <div className="flex items-center text-xs text-cyan-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity translate-x-[-10px] group-hover:translate-x-0">
              访问站点 <ExternalLink className="ml-1 w-3 h-3" />
            </div>
          </a>
        ))}

        {/* Add Friend Placeholder */}
        <div className="glass p-6 rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center text-center space-y-4 group cursor-pointer hover:border-cyan-500/50 transition-colors">
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
            <UserPlus className="w-6 h-6 opacity-40 group-hover:opacity-100 group-hover:text-cyan-400" />
          </div>
          <p className="text-sm opacity-40">交换友链？联系博主吧</p>
        </div>
      </div>

      <section className="glass p-8 rounded-3xl border border-white/5 space-y-6">
        <h2 className="text-xl font-bold border-l-4 border-cyan-500 pl-4">交换守则</h2>
        <div className="grid md:grid-cols-2 gap-8 text-sm opacity-70 leading-relaxed font-light">
          <ul className="space-y-3 list-disc list-inside">
            <li>站点内容积极向上，具有原创性</li>
            <li>已在贵站添加本博客链接</li>
            <li>长期稳定更新，不含恶意代码</li>
          </ul>
          <div className="glass bg-white/5 p-6 rounded-xl space-y-2">
            <p><strong>名称：</strong> VECTR</p>
            <p><strong>简介：</strong> 探索数学、代码与光影的未来派空间</p>
            <p><strong>图标：</strong> https://vectr.space/logo.png</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Friends;
