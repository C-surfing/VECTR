import React, { useEffect, useMemo, useState } from 'react';
import { Post, Comment, User } from '../types';
import { DB } from '../services/db';
import { auth } from '../services/auth';
import MarkdownContent from '../components/MarkdownContent';
import LazyImage from '../components/LazyImage';
import { TableOfContents } from '../components/TableOfContents';
import { ReadingProgress } from '../components/ReadingProgress';
import PostCategoryBadges from '../components/PostCategoryBadges';
import {
  Heart,
  MessageSquare,
  Share2,
  Clock,
  Eye,
  Send,
  Loader2,
  Edit,
  Trash2,
  AlertTriangle,
  CornerDownRight,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

const PostDetail: React.FC<{
  postId: string;
  user: User | null;
  onNavigate: (view: any, id?: any) => void;
  onPostResolved?: (post: Post) => void;
}> = ({ postId, user, onNavigate, onPostResolved }) => {
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [replyInput, setReplyInput] = useState('');
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [milestoneLabel, setMilestoneLabel] = useState('');
  const articleRef = React.useRef<HTMLElement>(null);
  const milestoneTimerRef = React.useRef<number | null>(null);

  // Keep identity stable to avoid effect loops.
  const currentUser = useMemo(() => user || auth.getCurrentUser(), [user]);
  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    let isActive = true;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      setComments([]);
      setReplyInput('');
      setReplyTargetId(null);

      try {
        let found = await DB.getPostById(postId);
        if (!found) {
          found = await DB.getPostById(postId, true);
        }

        if (!found) {
          if (!isActive) return;
          setError('文章不存在或已被删除');
          setLoading(false);
          return;
        }

        if (!isActive) return;
        setPost(found);
        onPostResolved?.(found);
        const likes = Array.isArray(found.likes) ? found.likes : [];
        setIsLiked(likes.includes(currentUser?.id || ''));
        setLoading(false);

        // Prefetch adjacent posts in background.
        void DB.prefetchAdjacentPosts(postId);

        // Comments do not block first paint.
        DB.getComments(postId)
          .then((commentsData) => {
            if (!isActive) return;
            setComments(commentsData);
          })
          .catch((commentsError) => {
            console.warn('Error loading comments:', commentsError);
          });

        // View count update should not block rendering.
        const updatedPost = { ...found, views: typeof found.views === 'number' ? found.views + 1 : 1 };
        if (isActive) {
          setPost(updatedPost);
        }
        try {
          await DB.savePost(updatedPost);
        } catch (viewUpdateError) {
          console.warn('Failed to update views, but keeping post visible:', viewUpdateError);
        }
      } catch (loadError) {
        if (!isActive) return;
        console.error('Error loading post:', loadError);
        setError('加载文章失败，请稍后重试');
        setLoading(false);
      }
    };

    loadData();
    return () => {
      isActive = false;
    };
  }, [postId, retryCount, currentUser?.id, onPostResolved]);

  useEffect(() => {
    let isActive = true;
    DB.getPosts()
      .then((posts) => {
        if (!isActive) return;
        setAllPosts(posts);
      })
      .catch((loadError) => {
        console.warn('Error loading discovery posts:', loadError);
      });
    return () => {
      isActive = false;
    };
  }, [postId]);

  useEffect(() => {
    return () => {
      if (milestoneTimerRef.current) {
        window.clearTimeout(milestoneTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!post) return;
    const root = articleRef.current;
    if (!root) return;

    const headings = Array.from(root.querySelectorAll('h2'));
    if (headings.length === 0) return;

    let lastHeadingText = '';
    let skippedFirst = false;

    const showMilestone = (text: string) => {
      if (!text || text === lastHeadingText) return;
      lastHeadingText = text;

      // Skip first hit on mount to avoid immediate popup.
      if (!skippedFirst) {
        skippedFirst = true;
        return;
      }

      setMilestoneLabel(`进入章节：${text}`);
      if (milestoneTimerRef.current) {
        window.clearTimeout(milestoneTimerRef.current);
      }
      milestoneTimerRef.current = window.setTimeout(() => {
        setMilestoneLabel('');
      }, 1700);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length === 0) return;
        const target = visible[0].target as HTMLElement;
        showMilestone((target.textContent || '').trim());
      },
      {
        root: null,
        rootMargin: '-38% 0px -55% 0px',
        threshold: [0, 1],
      },
    );

    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  }, [post?.id, post?.content]);

  const handleRetry = () => {
    setRetryCount((prev) => prev + 1);
  };

  const handleLike = async () => {
    if (!currentUser || !post) return;

    const newLikes = isLiked
      ? post.likes.filter((id) => id !== currentUser.id)
      : [...post.likes, currentUser.id];

    const updatedPost = { ...post, likes: newLikes };
    setPost(updatedPost);
    setIsLiked(!isLiked);

    try {
      await DB.savePost(updatedPost);
    } catch (likeError) {
      console.error('Error saving likes:', likeError);
    }
  };

  const submitComment = async (content: string, parentId: string | null = null) => {
    if (!currentUser || !content.trim()) return;
    const newComment: Comment = {
      id: Math.random().toString(36).slice(2, 11),
      postId,
      userId: currentUser.id,
      username: currentUser.username,
      userAvatar: currentUser.avatar,
      content: content.trim(),
      createdAt: Date.now(),
      parentId,
    };

    try {
      await DB.addComment(newComment);
      setComments((prev) => [newComment, ...prev]);
    } catch (commentError) {
      console.error('Error adding comment:', commentError);
      alert('评论发送失败，请重试');
    }
  };

  const handleAddComment = async () => {
    await submitComment(commentInput, null);
    setCommentInput('');
  };

  const handleReplyComment = async (parentId: string) => {
    await submitComment(replyInput, parentId);
    setReplyInput('');
    setReplyTargetId(null);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await DB.deletePost(postId);
      onNavigate('blog');
    } catch (deleteError) {
      console.error('Error deleting post:', deleteError);
      const message = deleteError instanceof Error ? deleteError.message : '删除失败，请重试';
      alert(message);
      setIsDeleting(false);
    }
  };

  const handleDeleteClick = () => {
    if (isDeleting) return;
    const confirmed = window.confirm('确定要删除这篇文章吗？此操作不可撤销。');
    if (confirmed) {
      handleDelete();
    }
  };

  const handleEdit = () => {
    onNavigate('editor', null, 'All', postId);
  };

  const commentRepliesMap = useMemo(() => {
    const map = new Map<string, Comment[]>();
    for (const comment of comments) {
      if (!comment.parentId) continue;
      if (!map.has(comment.parentId)) {
        map.set(comment.parentId, []);
      }
      map.get(comment.parentId)!.push(comment);
    }

    for (const list of map.values()) {
      list.sort((a, b) => a.createdAt - b.createdAt);
    }
    return map;
  }, [comments]);

  const topLevelComments = useMemo(
    () =>
      comments
        .filter((comment) => !comment.parentId)
        .sort((a, b) => b.createdAt - a.createdAt),
    [comments],
  );

  const seriesPosts = useMemo(() => {
    if (!post || post.category.length === 0) return [];
    const primaryCategory = post.category[0];
    return allPosts
      .filter((item) => item.category.includes(primaryCategory))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [allPosts, post]);

  const { prevSeriesPost, nextSeriesPost } = useMemo(() => {
    if (!post || seriesPosts.length === 0) {
      return { prevSeriesPost: null as Post | null, nextSeriesPost: null as Post | null };
    }
    const idx = seriesPosts.findIndex((item) => item.id === post.id);
    if (idx < 0) {
      return { prevSeriesPost: null as Post | null, nextSeriesPost: null as Post | null };
    }
    return {
      prevSeriesPost: idx < seriesPosts.length - 1 ? seriesPosts[idx + 1] : null,
      nextSeriesPost: idx > 0 ? seriesPosts[idx - 1] : null,
    };
  }, [post, seriesPosts]);

  const relatedPosts = useMemo(() => {
    if (!post) return [];
    const currentCategories = new Set(post.category);

    return allPosts
      .filter((item) => item.id !== post.id)
      .map((item) => {
        const shared = item.category.filter((cat) => currentCategories.has(cat)).length;
        const recencyScore = Math.max(0, 1 - (Date.now() - item.createdAt) / (1000 * 60 * 60 * 24 * 365));
        return {
          post: item,
          score: shared * 10 + recencyScore,
          shared,
        };
      })
      .filter((item) => item.shared > 0)
      .sort((a, b) => b.score - a.score || b.post.createdAt - a.post.createdAt)
      .slice(0, 3)
      .map((item) => item.post);
  }, [allPosts, post]);

  const isEmbed = (url: string) =>
    url.includes('youtube.com') ||
    url.includes('youtu.be') ||
    url.includes('bilibili.com') ||
    url.includes('vimeo.com') ||
    url.includes('embed');

  if (loading) {
    return (
      <div className="text-center py-20">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-cyan-400" />
        <p className="mt-4 text-cyan-400">正在加载时空数据...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 space-y-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>
        <p className="text-red-400 text-lg">{error}</p>
        <button
          onClick={handleRetry}
          className="px-6 py-3 bg-cyan-600 rounded-full hover:bg-cyan-500 transition-colors flex items-center mx-auto"
        >
          <Loader2 className="w-4 h-4 mr-2" />
          重试加载
        </button>
      </div>
    );
  }

  if (!post) {
    return <div className="text-center py-20">文章不存在</div>;
  }

  return (
    <>
      <ReadingProgress />
      {milestoneLabel && (
        <div className="fixed top-24 right-4 z-40 max-w-sm rounded-xl border border-cyan-400/35 bg-[#071022]/90 px-4 py-2 text-sm shadow-2xl shadow-cyan-900/40 backdrop-blur-sm">
          <span className="text-cyan-200">{milestoneLabel}</span>
        </div>
      )}
      <article className="animate-fade-in space-y-12">
        <header className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <PostCategoryBadges categories={post.category} coverImage={post.coverImage} seed={post.id} />
            <span className="opacity-20 ml-auto hidden md:block">|</span>
            <div className="flex items-center space-x-2 text-[10px] font-bold opacity-60 uppercase tracking-widest">
              <Clock className="w-3 h-3" />
              <span>{new Date(post.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          <h1 className="text-4xl md:text-6xl font-bold leading-tight text-glow">{post.title}</h1>

          <div className="flex items-center space-x-6 py-4 border-y border-white/5 opacity-60 text-sm font-mono">
            <div className="flex items-center">
              <Eye className="w-4 h-4 mr-2" /> {post.views} VIEWS
            </div>
            <div className="flex items-center">
              <Heart className={`w-4 h-4 mr-2 ${isLiked ? 'text-pink-500 fill-pink-500' : ''}`} />
              {post.likes.length} LIKES
            </div>
            <div className="flex items-center">
              <MessageSquare className="w-4 h-4 mr-2" /> {comments.length} COMMENTS
            </div>
          </div>
        </header>

        {post.coverImage && !post.videoUrl && (
          <div className="rounded-3xl overflow-hidden glass border border-white/10 shadow-2xl group">
            <LazyImage
              src={post.coverImage}
              alt={post.title}
              className="w-full object-cover max-h-[500px] group-hover:scale-[1.02] transition-transform duration-1000"
            />
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
              />
            ) : (
              <video src={post.videoUrl} className="w-full h-full object-contain" controls playsInline />
            )}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-8">
          <aside className="lg:w-64 flex-shrink-0 order-2 lg:order-1">
            <TableOfContents contentRef={articleRef} />
          </aside>
          <div className="flex-1 min-w-0 order-1 lg:order-2" ref={articleRef}>
            <div className="glass p-8 md:p-12 rounded-3xl border border-white/5">
              <MarkdownContent content={post.content} />
            </div>
          </div>
        </div>

        {(prevSeriesPost || nextSeriesPost) && (
          <section className="space-y-4">
            <h2 className="text-xl font-bold flex items-center">
              <Sparkles className="w-4 h-4 mr-2 text-cyan-400" />
              同系列导航
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <button
                onClick={() => prevSeriesPost && onNavigate('post', prevSeriesPost.id)}
                disabled={!prevSeriesPost}
                className="glass rounded-2xl border border-white/10 p-5 text-left transition-all hover:border-cyan-500/40 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <div className="text-xs uppercase tracking-widest opacity-50 mb-2 flex items-center">
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                  上一篇
                </div>
                <p className="font-bold line-clamp-2">
                  {prevSeriesPost ? prevSeriesPost.title : '已经是最早一篇'}
                </p>
              </button>
              <button
                onClick={() => nextSeriesPost && onNavigate('post', nextSeriesPost.id)}
                disabled={!nextSeriesPost}
                className="glass rounded-2xl border border-white/10 p-5 text-left transition-all hover:border-cyan-500/40 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <div className="text-xs uppercase tracking-widest opacity-50 mb-2 flex items-center justify-end">
                  下一篇
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </div>
                <p className="font-bold line-clamp-2 text-right">
                  {nextSeriesPost ? nextSeriesPost.title : '已经是最新一篇'}
                </p>
              </button>
            </div>
          </section>
        )}

        {relatedPosts.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xl font-bold flex items-center">
              <Sparkles className="w-4 h-4 mr-2 text-cyan-400" />
              相关文章
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              {relatedPosts.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onNavigate('post', item.id)}
                  className="glass rounded-2xl border border-white/10 p-5 text-left hover:border-cyan-500/40 transition-all"
                >
                  <PostCategoryBadges
                    categories={item.category}
                    coverImage={item.coverImage}
                    seed={`${item.id}-related`}
                    max={2}
                    className="flex flex-wrap gap-1 mb-3"
                  />
                  <p className="font-bold line-clamp-2 mb-2">{item.title}</p>
                  <p className="text-xs opacity-60 line-clamp-3">{item.excerpt}</p>
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="flex justify-center space-x-4 py-10">
          <button
            onClick={handleLike}
            className={`flex items-center px-8 py-3 rounded-full border transition-all ${
              isLiked ? 'bg-pink-500/20 border-pink-500 text-pink-500' : 'glass border-white/10 hover:border-pink-500/50'
            }`}
          >
            <Heart className={`w-5 h-5 mr-2 ${isLiked ? 'fill-pink-500' : ''}`} />
            {isLiked ? '已点赞' : '点赞'}
          </button>

          <button
            onClick={() => {
              const url = window.location.href;
              navigator.clipboard
                .writeText(url)
                .then(() => alert('文章链接已复制到剪贴板'))
                .catch(() => alert('复制失败，请手动复制'));
            }}
            className="flex items-center px-8 py-3 glass rounded-full border border-white/10 hover:border-cyan-500/50 transition-all"
          >
            <Share2 className="w-5 h-5 mr-2" /> 分享
          </button>

          {isAdmin && (
            <>
              <button
                onClick={handleEdit}
                className="flex items-center px-8 py-3 glass rounded-full border border-white/10 hover:border-cyan-500/50 transition-all text-cyan-400"
              >
                <Edit className="w-5 h-5 mr-2" /> 修改
              </button>
              <button
                onClick={handleDeleteClick}
                className="flex items-center px-8 py-3 glass rounded-full border border-red-500/30 hover:border-red-500/50 transition-all text-red-400 disabled:opacity-50"
                disabled={isDeleting}
              >
                {isDeleting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Trash2 className="w-5 h-5 mr-2" />}
                删除
              </button>
            </>
          )}
        </div>

        <section className="space-y-8 pb-20">
          <h2 className="text-2xl font-bold flex items-center font-orbitron">
            <MessageSquare className="mr-3 text-cyan-400" /> 交流空间 ({comments.length})
          </h2>

          {currentUser ? (
            <div className="glass p-6 rounded-2xl flex gap-4 border border-white/5">
              <img src={currentUser.avatar} className="w-10 h-10 rounded-full shrink-0 border border-cyan-500/30" />
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
              <button onClick={() => onNavigate('home')} className="mt-4 text-xs text-cyan-400 hover:underline">
                返回首页登录
              </button>
            </div>
          )}

          <div className="space-y-6">
            {topLevelComments.map((c) => {
              const replies = commentRepliesMap.get(c.id) || [];
              const isReplying = replyTargetId === c.id;
              return (
                <div key={c.id} className="glass p-6 rounded-2xl border-l-2 border-cyan-500/30 hover:bg-white/5 transition-colors">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center space-x-3">
                      <img src={c.userAvatar} className="w-8 h-8 rounded-full border border-white/10" />
                      <span className="font-bold text-sm">{c.username}</span>
                    </div>
                    <span className="text-[10px] opacity-40 font-mono">{new Date(c.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="opacity-80 text-sm leading-relaxed">{c.content}</p>

                  {currentUser && (
                    <div className="mt-4">
                      <button
                        onClick={() => {
                          setReplyTargetId(isReplying ? null : c.id);
                          setReplyInput('');
                        }}
                        className="text-xs text-cyan-300 hover:text-cyan-200 inline-flex items-center"
                      >
                        <CornerDownRight className="w-3.5 h-3.5 mr-1.5" />
                        {isReplying ? '取消回复' : '回复'}
                      </button>
                    </div>
                  )}

                  {isReplying && currentUser && (
                    <div className="mt-4 ml-2 border-l border-cyan-500/30 pl-4">
                      <textarea
                        value={replyInput}
                        onChange={(e) => setReplyInput(e.target.value)}
                        placeholder={`回复 ${c.username}...`}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-none h-20 text-sm"
                      />
                      <div className="flex justify-end mt-2">
                        <button
                          onClick={() => handleReplyComment(c.id)}
                          disabled={!replyInput.trim()}
                          className="px-4 py-1.5 bg-cyan-600 rounded-lg hover:bg-cyan-500 transition-colors flex items-center shadow-lg shadow-cyan-900/40 text-xs font-bold disabled:opacity-40"
                        >
                          发送回复 <Send className="ml-1.5 w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {replies.length > 0 && (
                    <div className="mt-5 space-y-3 ml-2 border-l border-white/10 pl-4">
                      {replies.map((reply) => (
                        <div key={reply.id} className="glass bg-white/5 p-4 rounded-xl border border-white/10">
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center space-x-2.5">
                              <img src={reply.userAvatar} className="w-6 h-6 rounded-full border border-white/10" />
                              <span className="font-bold text-xs">{reply.username}</span>
                            </div>
                            <span className="text-[10px] opacity-40 font-mono">{new Date(reply.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="opacity-80 text-sm leading-relaxed">{reply.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </article>
    </>
  );
};

export default PostDetail;
