import { db } from "../index";
import { posts } from "../schema";
import { eq, desc } from "drizzle-orm";
import { feed, feedFollows } from "../schema";

export async function getPostsForUser(userId: string, limit = 2) {
  return await db
    .select({
      title: posts.title,
      url: posts.url,
      description: posts.description,
      publishedAt: posts.publishedAt,
    })
    .from(posts)
    .innerJoin(feed, eq(posts.feed_id, feed.id))
    .innerJoin(feedFollows, eq(feedFollows.feed_id, feed.id))
    .where(eq(feedFollows.user_id, userId))
    .orderBy(desc(posts.publishedAt))
    .limit(limit);
}

export type NewPost = typeof posts.$inferInsert;

export async function createPost(post: NewPost) {
  const [result] = await db
    .insert(posts)
    .values(post)
    .onConflictDoNothing({ target: posts.url })
    .returning();

  return result;
}
