import React, { useState, useEffect } from 'react';
import { User, Post, Category } from './types';
import { DB } from './services/db';
import ParticleBackground from './components/ParticleBackground';
import { Home, Layout, BookOpen, User as UserIcon, LogOut, PlusSquare, Link2, ChevronRight, Ghost, Info } from 'lucide-react';

// Views
import HomeView from './views/Home';
import BlogListView from './views/BlogList';
import PostDetailView from './views/PostDetail';
import FriendsView from './views/Friends';
import AdminEditorView from './views/AdminEditor';
import AboutView from './views/About';

type View = 'home' | 'blog' | 'post' | 'friends' | 'editor' | 'about';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('home');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category | 'All'>('All');
  const [user, setUser] = useState<User | null>(DB.getCurrentUser());
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navigate = (view: View, postId: string | null = null, category: Category | 'All' = 'All') => {
    setCurrentView(view);
    setSelectedPostId(postId);
    setActiveCategory(category);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setIsMenuOpen(false);
  };

  const handleLogin = (name: string) => {
    const newUser = DB.login(name);
    setUser(newUser);
    navigate('home');
  };

  const handleLogout = () => {
    DB.logout();
    setUser(null);
    navigate('home');
  };

  const logoText = "VECTR";

  return (
    <div className="min-h-screen relative selection:bg-cyan-500/30">
      <ParticleBackground />
      
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/5 py-4">
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <div 
            onClick={() => navigate('home')} 
            className="flex items-center space-x-2 cursor-pointer logo-group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <Ghost className="w-6 h-6 text-white" />
            </div>
            <div className="font-orbitron text-2xl font-bold tracking-tighter text-glow uppercase ml-2 flex">
              {logoText.split('').map((char, index) => (
                <span 
                  key={index} 
                  className="wave-char" 
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  {char}
                </span>
              ))}
            </div>
          </div>

          <div className="hidden md:flex items-center space-x-10 font-medium">
            <button onClick={() => navigate('home')} className="hover:text-cyan-400 transition-colors uppercase tracking-[0.2em] text-sm font-bold">首页</button>
            <button onClick={() => navigate('blog')} className="hover:text-cyan-400 transition-colors uppercase tracking-[0.2em] text-sm font-bold">归档</button>
            <button onClick={() => navigate('about')} className="hover:text-cyan-400 transition-colors uppercase tracking-[0.2em] text-sm font-bold">关于</button>
            <button onClick={() => navigate('friends')} className="hover:text-cyan-400 transition-colors uppercase tracking-[0.2em] text-sm font-bold">友链</button>
            {user?.role === 'admin' && (
              <button onClick={() => navigate('editor')} className="flex items-center text-cyan-400 hover:text-cyan-300 uppercase tracking-[0.2em] text-sm font-bold">
                <PlusSquare className="w-5 h-5 mr-2" /> 发布
              </button>
            )}
            {user ? (
              <div className="flex items-center space-x-6 pl-6 border-l border-white/10">
                <div className="flex items-center space-x-3">
                  <img src={user.avatar} className="w-9 h-9 rounded-full border border-cyan-500/50" />
                  <span className="text-xs font-bold opacity-90 uppercase tracking-widest">{user.username}</span>
                </div>
                <button onClick={handleLogout} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <LogOut className="w-5 h-5 text-red-400" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => handleLogin('Admin')} 
                className="px-6 py-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-cyan-500/20 hover:border-cyan-500/50 transition-all duration-300 text-xs font-bold uppercase tracking-[0.25em]"
              >
                Login
              </button>
            )}
          </div>

          <button className="md:hidden p-2" onClick={() => setIsMenuOpen(!isMenuOpen)}>
             <Layout className="w-7 h-7" />
          </button>
        </div>
        
        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden glass absolute top-full left-0 right-0 p-8 flex flex-col space-y-6 animate-fade-in border-t border-white/10">
             <button onClick={() => navigate('home')} className="text-lg font-bold uppercase tracking-widest">首页</button>
             <button onClick={() => navigate('blog')} className="text-lg font-bold uppercase tracking-widest">归档</button>
             <button onClick={() => navigate('about')} className="text-lg font-bold uppercase tracking-widest">关于</button>
             <button onClick={() => navigate('friends')} className="text-lg font-bold uppercase tracking-widest">友链</button>
             {user?.role === 'admin' && <button onClick={() => navigate('editor')} className="text-lg font-bold uppercase tracking-widest text-cyan-400">发布文章</button>}
             {!user && <button onClick={() => handleLogin('Admin')} className="text-lg font-bold uppercase tracking-widest">登入</button>}
             {user && <button onClick={handleLogout} className="text-lg font-bold uppercase tracking-widest text-red-400">登出</button>}
          </div>
        )}
      </nav>

      {/* Main Content Area */}
      <main className="pt-24 pb-20 px-4 md:px-0">
        <div className="max-w-5xl mx-auto">
          {currentView === 'home' && <HomeView onNavigate={navigate} />}
          {currentView === 'blog' && <BlogListView onNavigate={navigate} activeCategory={activeCategory} setActiveCategory={setActiveCategory} />}
          {currentView === 'post' && selectedPostId && <PostDetailView postId={selectedPostId} user={user} onNavigate={navigate} />}
          {currentView === 'friends' && <FriendsView />}
          {currentView === 'editor' && user?.role === 'admin' && <AdminEditorView onNavigate={navigate} />}
          {currentView === 'about' && <AboutView />}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-12 border-t border-white/5 glass">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-xs opacity-30 font-bold uppercase tracking-[0.4em]">© 2026 VECTR_SPACE. SIGNAL_STABLE.</p>
        </div>
      </footer>
    </div>
  );
};

export default App;