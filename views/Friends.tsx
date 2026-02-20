import React, { useState, useEffect, useCallback } from 'react';
import { DB } from '../services/db';
import { Friend, User, FriendStatus } from '../types';
import { ExternalLink, UserPlus, Loader2, X, Link2, Check, Ban } from 'lucide-react';

const safeHostname = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

interface FriendsProps {
  user?: User | null;
  onDataChange?: () => void;
}

const Friends: React.FC<FriendsProps> = ({ user = null, onDataChange }) => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingFriends, setPendingFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const isAdmin = user?.role === 'admin';

  const loadFriends = useCallback(
    async (withLoading: boolean = true) => {
      if (withLoading) setLoading(true);
      try {
        const [approved, pending] = await Promise.all([
          DB.getFriends({ status: 'approved' }),
          isAdmin ? DB.getFriendApplications() : Promise.resolve([]),
        ]);
        setFriends(approved);
        setPendingFriends(pending);
      } catch (error) {
        console.error('Error loading friends:', error);
      } finally {
        if (withLoading) setLoading(false);
      }
    },
    [isAdmin],
  );

  useEffect(() => {
    void loadFriends(true);
  }, [loadFriends]);

  const handleReview = async (friendId: string, status: FriendStatus) => {
    setReviewingId(friendId);
    try {
      await DB.updateFriendStatus(friendId, status);
      await loadFriends(false);
      onDataChange?.();
    } catch (error) {
      console.error('Review friend failed:', error);
      const message = error instanceof Error ? error.message : '审核失败';
      alert(message);
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <div className="space-y-12">
      <header className="text-center space-y-4 max-w-2xl mx-auto">
        <h1 className="text-4xl font-orbitron font-bold">友链 <span className="text-cyan-400">.links</span></h1>
        <p className="opacity-60 font-light">
          万千星辰中，总会有交织的轨迹。在这里，我们遇见志同道合的旅伴。
        </p>
      </header>

      {loading ? (
        <div className="text-center py-20">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-cyan-400" />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {friends.map((friend) => (
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
                  <span className="text-xs opacity-40">{safeHostname(friend.url)}</span>
                </div>
              </div>
              <p className="text-sm opacity-60 leading-relaxed mb-4">{friend.description}</p>
              <div className="flex items-center text-xs text-cyan-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity translate-x-[-10px] group-hover:translate-x-0">
                访问站点 <ExternalLink className="ml-1 w-3 h-3" />
              </div>
            </a>
          ))}

          <div
            onClick={() => setShowAddModal(true)}
            className="glass p-6 rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center text-center space-y-4 group cursor-pointer hover:border-cyan-500/50 transition-colors min-h-[200px]"
          >
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
              <UserPlus className="w-6 h-6 opacity-40 group-hover:opacity-100 group-hover:text-cyan-400" />
            </div>
            <p className="text-sm opacity-40">申请交换友链</p>
          </div>
        </div>
      )}

      {isAdmin && (
        <section className="glass p-8 rounded-3xl border border-white/5 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold border-l-4 border-amber-400 pl-4">待审核申请</h2>
            <span className="text-xs opacity-50">共 {pendingFriends.length} 条</span>
          </div>
          {pendingFriends.length === 0 ? (
            <p className="text-sm opacity-50">暂无待审核友链申请</p>
          ) : (
            <div className="space-y-3">
              {pendingFriends.map((friend) => (
                <div key={friend.id} className="glass bg-white/5 p-4 rounded-xl border border-white/10 flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <img src={friend.avatar} className="w-12 h-12 rounded-xl object-cover border border-white/10" />
                    <div className="min-w-0">
                      <p className="font-bold truncate">{friend.name}</p>
                      <p className="text-xs opacity-50 truncate">{friend.url}</p>
                      {friend.description ? <p className="text-xs opacity-60 mt-1 line-clamp-2">{friend.description}</p> : null}
                    </div>
                  </div>
                  <div className="flex gap-2 md:justify-end">
                    <button
                      onClick={() => handleReview(friend.id, 'approved')}
                      disabled={reviewingId === friend.id}
                      className="px-4 py-2 rounded-lg text-xs font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50 flex items-center"
                    >
                      {reviewingId === friend.id ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1.5" />}
                      通过
                    </button>
                    <button
                      onClick={() => handleReview(friend.id, 'rejected')}
                      disabled={reviewingId === friend.id}
                      className="px-4 py-2 rounded-lg text-xs font-bold bg-rose-500/20 border border-rose-500/40 text-rose-300 hover:bg-rose-500/30 disabled:opacity-50 flex items-center"
                    >
                      {reviewingId === friend.id ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Ban className="w-3.5 h-3.5 mr-1.5" />}
                      拒绝
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

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
            <p><strong>简介：</strong> 深大大一学生的个人博客</p>
            <p><strong>网址：</strong> https://vectr-delta.vercel.app/</p>
          </div>
        </div>
      </section>

      {showAddModal && (
        <AddFriendModal
          onClose={() => setShowAddModal(false)}
          onSubmitted={() => {
            void loadFriends(false);
            onDataChange?.();
          }}
        />
      )}
    </div>
  );
};

const AddFriendModal: React.FC<{ onClose: () => void; onSubmitted?: () => void }> = ({ onClose, onSubmitted }) => {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [avatar, setAvatar] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !url) return;

    setSubmitting(true);
    try {
      const newFriend: Friend = {
        id: Math.random().toString(36).substr(2, 9),
        name,
        url,
        description,
        avatar: avatar || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${name}`,
        status: 'pending',
        createdAt: Date.now(),
      };
      await DB.addFriend(newFriend);
      setSubmitted(true);
      onSubmitted?.();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Error adding friend:', error);
      const message = error instanceof Error ? error.message : '提交失败';
      alert(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
        <div className="relative glass p-12 rounded-3xl border border-white/10 max-w-md w-full mx-4 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
            <ExternalLink className="w-8 h-8 text-green-400" />
          </div>
          <h3 className="text-xl font-bold mb-2">申请已提交！</h3>
          <p className="opacity-60">博主审核通过后会自动展示到友链列表。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative glass p-8 rounded-3xl border border-white/10 max-w-md w-full mx-4 shadow-2xl animate-fade-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <X className="w-5 h-5 opacity-60" />
        </button>

        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
            <Link2 className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold font-orbitron">申请交换友链</h2>
          <p className="text-sm opacity-50 mt-2">填写你的站点信息，提交后进入待审核队列</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              placeholder="网站名称 *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 text-sm"
              required
            />
          </div>
          <div>
            <input
              type="url"
              placeholder="网站链接 * (https://...)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 text-sm"
              required
            />
          </div>
          <div>
            <input
              type="url"
              placeholder="头像链接 (可选)"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 text-sm"
            />
          </div>
          <div>
            <textarea
              placeholder="网站简介 (可选)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 text-sm h-24 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !name || !url}
            className="w-full py-4 bg-gradient-to-r from-cyan-600 to-indigo-600 rounded-xl font-bold hover:scale-[1.02] transition-all shadow-lg shadow-cyan-900/40 disabled:opacity-30 disabled:scale-100"
          >
            {submitting ? (
              <span className="flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> 提交中...
              </span>
            ) : '提交申请'}
          </button>
        </form>

        <p className="text-center text-xs opacity-30 mt-6">
          提交后博主会审核，通过后即可显示
        </p>
      </div>
    </div>
  );
};

export default Friends;
