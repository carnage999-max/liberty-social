// global.d.ts
declare global {
  type User = import("@/lib/types").User;
  type Post = import("@/lib/types").Post;
  type Comment = import("@/lib/types").Comment;
}
export {};
