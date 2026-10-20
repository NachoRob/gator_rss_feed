import { db } from "..";
import { feed, feedFollows } from "../schema";
import { getTableColumns, sql } from "drizzle-orm";
import { and, eq } from "drizzle-orm";
import { users } from "../schema";

export async function createFeed(name: string, url: string, userId: string) {
  const [result] = await db
    .insert(feed)
    .values({ name: name, url: url, user_id: userId })
    .returning();

  return result;
}

export async function getFeeds() {
  const result = await db.select().from(feed);

  return result;
}

export async function markFeedFetched(feedId: string) {
  const [result] = await db
    .update(feed)
    .set({
      lastFetchedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(feed.id, feedId))
    .returning();

  return result;
}

export async function getNextFeedToFetch() {
  const [result] = await db
    .select()
    .from(feed)
    .orderBy(sql`${feed.lastFetchedAt} ASC NULLS FIRST`)
    .limit(1);
  return result;
}

export async function deleteFeedFollow(userId: string, url: string) {
  const feed = await getFeedByUrl(url);

  if (!feed) {
    throw new Error("No feed matches given url");
  }

  const [newFeedFollow] = await db
    .delete(feedFollows)
    .where(
      and(eq(feedFollows.user_id, userId), eq(feedFollows.feed_id, feed.id)),
    )
    .returning();

  return newFeedFollow;
}

export async function getFeedByUrl(url: string) {
  const [result] = await db.select().from(feed).where(eq(feed.url, url));

  if (!result) {
    throw new Error("feed doesn't exist");
  }
  return result;
}

export async function createFeedFollow(userId: string, feedId: string) {
  const [newFeedFollow] = await db
    .insert(feedFollows)
    .values({ user_id: userId, feed_id: feedId })
    .returning();

  const [result] = await db
    .select({
      ...getTableColumns(feedFollows),
      userName: users.name,
      feedName: feed.name,
    })
    .from(feedFollows)
    .innerJoin(users, eq(feedFollows.user_id, users.id))
    .innerJoin(feed, eq(feedFollows.feed_id, feed.id))
    .where(eq(feedFollows.id, newFeedFollow.id));

  return result;
}

export async function getFeedsFollowsForUser(userId: string) {
  const result = await db
    .select({
      ...getTableColumns(feedFollows),
      userName: users.name,
      feedName: feed.name,
    })
    .from(feedFollows)
    .innerJoin(users, eq(feedFollows.user_id, users.id))
    .innerJoin(feed, eq(feedFollows.feed_id, feed.id))
    .where(eq(users.id, userId));

  return result;
}
