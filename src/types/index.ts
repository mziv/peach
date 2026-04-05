export interface User {
  uid: string;
  username: string;
  displayName: string;
  createdAt: Date;
}

export interface UserMeta {
  lastPostText: string;
  lastPostAt: Date;
}

export interface Post {
  postId: string;
  text: string;
  createdAt: Date;
  commentCount: number;
  likeCount: number;
}

export interface Comment {
  commentId: string;
  authorUid: string;
  authorUsername: string;
  text: string;
  createdAt: Date;
}

export interface Friendship {
  friendshipId: string;
  requesterId: string;
  receiverId: string;
  status: "pending" | "accepted";
  createdAt: Date;
}
