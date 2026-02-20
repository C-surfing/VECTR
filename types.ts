export type Category = 'CS' | 'TA' | '\u91d1\u878d' | '\u6570\u5b66' | '\u5149\u5f71\u827a\u672f' | 'AI' | '\u751f\u6d3b' | '\u54f2\u5b66';

export interface User {
  id: string;
  username: string;
  avatar: string;
  role: 'admin' | 'user';
}

export interface Post {
  id: string;
  title: string;
  content: string; // Markdown supported
  excerpt: string;
  category: Category[]; // Multiple categories support
  coverImage?: string;
  videoUrl?: string;
  authorId: string;
  authorName: string;
  createdAt: number;
  likes: string[]; // Array of userIds
  views: number;
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  username: string;
  userAvatar: string;
  content: string;
  createdAt: number;
  parentId?: string | null;
}

export type FriendStatus = 'approved' | 'pending' | 'rejected';

export interface Friend {
  id: string;
  name: string;
  url: string;
  description: string;
  avatar: string;
  status?: FriendStatus;
  createdAt?: number;
}
