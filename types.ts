
export type Category = 'CS' | 'TA' | '金融' | '数学' | '光影艺术' | 'AI';

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
}

export interface Friend {
  id: string;
  name: string;
  url: string;
  description: string;
  avatar: string;
}
