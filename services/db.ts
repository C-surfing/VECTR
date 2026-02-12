import { Post, User, Comment, Friend } from '../types';

const STORAGE_KEYS = {
  POSTS: 'blog_posts',
  USERS: 'blog_users',
  COMMENTS: 'blog_comments',
  FRIENDS: 'blog_friends',
  CURRENT_USER: 'blog_current_user'
};

// Seed initial data if empty
const seed = () => {
  if (!localStorage.getItem(STORAGE_KEYS.POSTS)) {
    const initialPosts: Post[] = [
      {
        id: '1',
        title: 'VECTR: 算法与艺术的交叉点',
        content: '在现代渲染引擎中，我们追求的不仅是速度，更是光影的灵动。数学公式是构建这一切的基石：\n\n$$ I = L_e + \\int_{\\Omega} f_r(x, \\omega_i, \\omega_o) L_i(x, \\omega_i) (\\omega_i \\cdot n) d\\omega_i $$\n\n这是著名的渲染方程，定义了光的传输。',
        excerpt: '探索如何通过数学模型构建出极具未来感的视觉效果。',
        category: ['数学', '光影艺术', 'TA'],
        coverImage: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=800&auto=format&fit=crop',
        authorId: 'admin',
        authorName: 'VECTR_ARCH',
        createdAt: Date.now() - 86400000,
        likes: [],
        views: 120
      },
      {
        id: '2',
        title: '大规模语言模型的微调策略',
        content: 'AI 不仅仅是黑盒，通过 LoRA (Low-Rank Adaptation) 等技术，我们可以高效地在消费级显卡上运行大模型。\n\n我们将分类维度扩展到了 **AI** 分支，以记录这些前沿探索。',
        excerpt: '浅蓝紫色调的设计美学与技术实现的深度融合。',
        category: ['CS', 'AI'],
        coverImage: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?q=80&w=800&auto=format&fit=crop',
        authorId: 'admin',
        authorName: 'VECTR_ARCH',
        createdAt: Date.now() - 43200000,
        likes: [],
        views: 85
      }
    ];
    localStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(initialPosts));
  }

  // Clear friends for fresh start
  if (!localStorage.getItem(STORAGE_KEYS.FRIENDS)) {
    localStorage.setItem(STORAGE_KEYS.FRIENDS, JSON.stringify([]));
  }
};

seed();

export const DB = {
  getPosts: (): Post[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.POSTS) || '[]'),
  savePost: (post: Post) => {
    const posts = DB.getPosts();
    const existingIndex = posts.findIndex(p => p.id === post.id);
    if (existingIndex > -1) posts[existingIndex] = post;
    else posts.push(post);
    localStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(posts));
  },
  deletePost: (id: string) => {
    const posts = DB.getPosts().filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(posts));
  },
  
  getComments: (postId: string): Comment[] => {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.COMMENTS) || '[]') as Comment[];
    return all.filter(c => c.postId === postId);
  },
  addComment: (comment: Comment) => {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.COMMENTS) || '[]') as Comment[];
    all.push(comment);
    localStorage.setItem(STORAGE_KEYS.COMMENTS, JSON.stringify(all));
  },

  getFriends: (): Friend[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.FRIENDS) || '[]'),
  addFriend: (friend: Friend) => {
    const all = DB.getFriends();
    all.push(friend);
    localStorage.setItem(STORAGE_KEYS.FRIENDS, JSON.stringify(all));
  },

  getCurrentUser: (): User | null => {
    const user = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    return user ? JSON.parse(user) : null;
  },
  login: (username: string): User => {
    const user: User = { 
      id: Math.random().toString(36).substr(2, 9), 
      username, 
      avatar: `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${username}`, 
      role: username.toLowerCase() === 'admin' ? 'admin' : 'user' 
    };
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    return user;
  },
  logout: () => localStorage.removeItem(STORAGE_KEYS.CURRENT_USER)
};