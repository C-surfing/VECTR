
import React, { useState, useEffect } from 'react';
import { Post, Comment, User } from '../types';
import { DB } from '../services/db';
import MarkdownContent from '../components/MarkdownContent';
import { Heart, MessageSquare, Share2, ArrowLeft, Clock, Eye, Send, Hash } from 'lucide-react';

const PostDetail: React.FC<{ postId: string, user: User | null, onNavigate: (view: any, id?: any) => void }> = ({ postId, user, onNavigate }) => {
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [isLiked, setIsLiked] = useState(false);

  useEffect(() => {
    const p = DB.getPosts().find(it => it.id === postId);
    if (p) {
      setPost(p);
      setComments(DB.getComments(postId));
      setIsLiked(p.likes.includes(user?.id || ''));
      
      // Update views
      p.views += 1;
      DB.savePost(p);
    }
  }, [postId, user]);

  const handleLike = () => {
    if (!user || !post) return;
    const newLikes = isLiked 
      ? post.likes.filter(id => id !== user.id)
      : [...post.likes, user.id];
    
    const updatedPost = { ...post, likes: newLikes };
    DB.savePost(updatedPost);
    setPost(updatedPost);
    setIsLiked(!isLiked);
  };

  const handleAddComment = () => {
    if (!user || !commentInput.trim()) return;
    const newComment: Comment = {
      id: Math.random().toString(36).substr(2, 9),
      postId,
      userId: user.id,
      username: user.username,
      userAvatar: user.avatar,
      content: commentInput,
      createdAt: Date.now()
    };
    DB.addComment(newComment);
    setComments([...comments, newComment]);
    setCommentInput('');
  };

  if (!post) return <div className="text-center py-20">正在加载时空数据...</div>;

  const isEmbed = (url: string) => {
    if (!url) return false;
    return url.includes('youtube.com') || 
           url.includes('youtu.be') || 
           url.includes('bilibili.com') || 
           url.includes('vimeo.com') ||
           url.includes('embed');
  };

  return (
    <article className="animate-fade-in space-y-12">
      <button onClick={() => onNavigate('blog')} className="flex items-center text-sm opacity-60 hover:opacity-100 transition-opacity">
        <ArrowLeft className="w-4 h-4 mr-1" /> 返回列表
      </button>

      {/* Hero Header */}
      <header className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          {post.category.map(cat => (
            <span key={cat} className="flex items-center text-[10px] font-bold text-cyan-400 uppercase tracking-widest bg-cyan-500/10 px-2 py-1 rounded">
              <Hash className="w-2.5 h-2.5 mr-1" /> {cat}
            </span>
          ))}
          <span className="opacity-20 ml-auto hidden md:block">|</span>
          <div className="flex items-center space-x-2 text-[10px] font-bold opacity-60 uppercase tracking-widest">
            <Clock className="w-3 h-3" />
            <span>{new Date(post.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
        <h1 className="text-4xl md:text-6xl font-bold leading-tight text-glow">{post.title}</h1>
        <div className="flex items-center space-x-6 py-4 border-y border-white/5 opacity-60 text-sm font-mono">
          <div className="flex items-center"><Eye className="w-4 h-4 mr-2" /> {post.views} VIEWS</div>
          <div className="flex items-center"><Heart className={`w-4 h-4 mr-2 ${isLiked ? 'text-pink-500 fill-pink-500' : ''}`} /> {post.likes.length} LIKES</div>
          <div className="flex items-center"><MessageSquare className="w-4 h-4 mr-2" /> {comments.length} COMMENTS</div>
        </div>
      </header>

      {/* Media */}
      {post.coverImage && !post.videoUrl && (
        <div className="rounded-3xl overflow-hidden glass border border-white/10 shadow-2xl group">
          <img src={post.coverImage} className="w-full object-cover max-h-[500px] group-hover:scale-[1.02] transition-transform duration-1000" />
        </div>
      )}
      
      {post.videoUrl && (
        <div className="aspect-video rounded-3xl overflow-hidden glass border border-white/10 shadow-2xl bg-black/40">
          {isEmbed(post.videoUrl) ? (
            <iframe 
              src={post.videoUrl} 
              className="w-full h-full"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          ) : (
            <video 
              src={post.videoUrl} 
              className="w-full h-full object-contain"
              controls
              playsInline
            />
          )}
        </div>
      )}

      {/* Content */}
      <div className="glass p-8 md:p-12 rounded-3xl border border-white/5">
        <MarkdownContent content={post.content} />
      </div>

      {/* Actions */}
      <div className="flex justify-center space-x-4 py-10">
        <button 
          onClick={handleLike}
          className={`flex items-center px-8 py-3 rounded-full border transition-all ${
            isLiked ? 'bg-pink-500/20 border-pink-500 text-pink-500' : 'glass border-white/10 hover:border-pink-500/50'
          }`}
        >
          <Heart className={`w-5 h-5 mr-2 ${isLiked ? 'fill-pink-500' : ''}`} /> {isLiked ? '已点赞' : '点赞'}
        </button>
        <button className="flex items-center px-8 py-3 glass rounded-full border border-white/10 hover:border-cyan-500/50 transition-all">
          <Share2 className="w-5 h-5 mr-2" /> 分享
        </button>
      </div>

      {/* Comments Section */}
      <section className="space-y-8 pb-20">
        <h2 className="text-2xl font-bold flex items-center font-orbitron">
          <MessageSquare className="mr-3 text-cyan-400" /> 交流空间 ({comments.length})
        </h2>
        
        {user ? (
          <div className="glass p-6 rounded-2xl flex gap-4 border border-white/5">
            <img src={user.avatar} className="w-10 h-10 rounded-full shrink-0 border border-cyan-500/30" />
            <div className="flex-1 space-y-4">
              <textarea 
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="在此输入你的想法..."
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-none h-24 text-sm"
              />
              <button 
                onClick={handleAddComment}
                className="px-6 py-2 bg-cyan-600 rounded-lg hover:bg-cyan-500 transition-colors flex items-center float-right shadow-lg shadow-cyan-900/40 text-sm font-bold"
              >
                发送 <Send className="ml-2 w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="glass p-10 rounded-2xl text-center border-dashed border-white/20">
            <p className="opacity-50">登录后即可参与讨论</p>
            <button onClick={() => onNavigate('home')} className="mt-4 text-xs text-cyan-400 hover:underline">返回首页进行登录</button>
          </div>
        )}

        <div className="space-y-6">
          {comments.map(c => (
            <div key={c.id} className="glass p-6 rounded-2xl border-l-2 border-cyan-500/30 hover:bg-white/5 transition-colors">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center space-x-3">
                  <img src={c.userAvatar} className="w-8 h-8 rounded-full border border-white/10" />
                  <span className="font-bold text-sm">{c.username}</span>
                </div>
                <span className="text-[10px] opacity-40 font-mono">{new Date(c.createdAt).toLocaleString()}</span>
              </div>
              <p className="opacity-80 text-sm leading-relaxed">{c.content}</p>
            </div>
          ))}
        </div>
      </section>
    </article>
  );
};

export default PostDetail;
