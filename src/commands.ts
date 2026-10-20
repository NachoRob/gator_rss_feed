import { setUser, readConfig } from "../src/config.js";
import {
  createUser,
  getUserByName,
  getUserById,
  resetUsers,
  getUsers,
} from "../src/lib/db/queries/users.js";
import type { Feed, User } from "../src/lib/db/schema.js";
import {
  deleteFeedFollow,
  createFeed,
  getFeeds,
  createFeedFollow,
  getFeedByUrl,
  getFeedsFollowsForUser,
  getNextFeedToFetch,
  markFeedFetched,
} from "../src/lib/db/queries/feeds.js";
import { fetchFeed } from "../src/lib/rss.js";
import { createPost, getPostsForUser } from "./lib/db/queries/posts";

// types
export type CommandHandler = (
  cmdName: string,
  ...args: string[]
) => Promise<void>;

export type UserCommandHandler = (
  cmdName: string,
  user: User,
  ...args: string[]
) => Promise<void>;

export type CommandsRegistry = Record<string, CommandHandler>;

// handlerFunctions
export async function handlerBrowse(
  cmdName: string,
  user: User,
  ...args: string[]
): Promise<void> {
  if (args.length > 1) {
    throw new Error("Usage: browse [limit]");
  }

  const limit = args.length === 1 ? Number(args[0]) : 2;

  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error("Limit must be a positive integer");
  }

  const posts = await getPostsForUser(user.id, limit);

  for (const post of posts) {
    console.log(`\n${post.title}`);
    console.log(post.url);
    console.log(post.description ?? "");
    console.log(`Published: ${post.publishedAt ?? "Unknown"}`);
  }
}

export function parseDuration(durationStr: string): number {
  const regex = /^(\d+)(ms|s|m|h)$/;
  const match = durationStr.match(regex);

  if (match === null) {
    throw new Error("No match");
  }

  const unity = match[2];
  const quantity = parseInt(match[1], 10);

  if (unity === "ms") {
    return quantity;
  } else if (unity === "s") {
    return quantity * 1_000;
  } else if (unity === "m") {
    return quantity * 60_000;
  } else if (unity === "h") {
    return quantity * 60 * 60 * 1_000;
  } else {
    throw new Error("Unidad de tiempo no válida, papito");
  }
}

export async function scrapeFeeds() {
  const nextFeed = await getNextFeedToFetch();

  if (!nextFeed) {
    throw new Error("No feed to fetch");
  }

  // Marcar antes de pedir el feed: si falla, pasa al final de la cola
  // y no bloquea a los demás feeds en cada tick.
  await markFeedFetched(nextFeed.id);

  let result;
  try {
    result = await fetchFeed(nextFeed.url);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch feed ${nextFeed.url}: ${message}`);
  }

  for (const item of result.channel.item) {
    const publishedAt = item.pubDate ? new Date(item.pubDate) : null;

    await createPost({
      title: item.title,
      url: item.link,
      description: item.description ?? null,
      publishedAt:
        publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null,
      feed_id: nextFeed.id,
    });
  }
}

function logScrapeError(error: unknown) {
  console.error(error instanceof Error ? error.message : error);
}

export async function handlerUnfollow(
  cmdName: string,
  user: User,
  ...args: string[]
) {
  if (args.length !== 1) {
    throw new Error("unfollow requires exactly one URL");
  }
  const url = args[0];

  const deletedFollow = await deleteFeedFollow(user.id, url);

  if (!deletedFollow) {
    throw new Error(`user ${user.name} is not following feed ${url}`);
  }

  console.log(`successfully unfollowed feed ${url}`);
}

export async function handlerFollow(
  cmdName: string,
  user: User,
  ...args: string[]
) {
  if (args.length !== 1) {
    throw new Error("The add feed handler expects 1 argument: URL");
  }
  const url = args[0];

  const feed = await getFeedByUrl(url);

  const feedFollow = await createFeedFollow(user.id, feed.id);

  console.log(`user: ${feedFollow.userName}, feed: ${feedFollow.feedName}`);
}

export async function handlerReset(cmdName: string, ...args: string[]) {
  await resetUsers();
  console.log("Users reset successfully!");
}

function printFeed(feed: Feed, user: User) {
  console.log(`ID: ${feed.id}`);
  console.log(`Created at: ${feed.createdAt}`);
  console.log(`Updated at: ${feed.updatedAt}`);
  console.log(`Name: ${feed.name}`);
  console.log(`URL: ${feed.url}`);
  console.log(`User: ${user.name}`);
}

export async function handlerFollowing(
  cmdName: string,
  user: User,
  ...args: string[]
) {
  const userFollowing = await getFeedsFollowsForUser(user.id);

  if (userFollowing.length === 0) {
    console.log(`Current user ${user.name} doesn't follow any feed`);
  }
  for (const follow of userFollowing) {
    console.log(follow.feedName);
  }
}

export async function handlerAddFeed(
  cmdName: string,
  user: User,
  ...args: string[]
) {
  if (args.length !== 2) {
    throw new Error("The add feed handler expects 2 arguments: name and URL");
  }

  const name = args[0];
  const url = args[1];

  const feed = await createFeed(name, url, user.id);

  await createFeedFollow(user.id, feed.id);
  printFeed(feed, user);
}

export async function handlerFeeds(cmdName: string, ...args: string[]) {
  const feeds = await getFeeds();

  for (const feed of feeds) {
    console.log(`Name: ${feed.name}`);
    console.log(`URL: ${feed.url}`);

    const user = await getUserById(feed.user_id);
    console.log(`User: ${user.name}`);
  }
}

export async function handlerAgg(
  cmdName: string,
  ...args: string[]
): Promise<void> {
  if (args.length !== 1) {
    throw new Error("The agg handler expects a single duration argument");
  }

  const interval = parseDuration(args[0]);

  console.log(`Collecting feeds every ${args[0]}`);

  // Ejecutar inmediatamente
  await scrapeFeeds().catch(logScrapeError);

  // Repetir según el intervalo
  const intervalId = setInterval(() => {
    scrapeFeeds().catch(logScrapeError);
  }, interval);

  // Mantener el programa activo hasta Ctrl+C
  await new Promise<void>((resolve) => {
    process.on("SIGINT", () => {
      clearInterval(intervalId);
      console.log("\nStopping feed aggregator...");
      resolve();
    });
  });
}

export async function handlerGetUsers(cmdName: string, ...args: string[]) {
  const users = await getUsers();

  const config = readConfig();

  for (const user of users) {
    if (user.name === config.currentUserName) {
      console.log(`* ${user.name} (current)`);
    } else {
      console.log(`* ${user.name}`);
    }
  }
}

export async function handlerLogin(cmdName: string, ...args: string[]) {
  if (args.length === 0) {
    throw new Error(
      "The login handler expects a single argument, the username",
    );
  }

  const userName = args[0];

  const user = await getUserByName(userName);

  if (!user) {
    throw new Error("The given user name doesn't exist in the database");
  }

  await setUser(user.name);

  console.log("Login was succesfull!");
}

export async function handlerRegister(cmdName: string, ...args: string[]) {
  if (args.length === 0) {
    throw new Error(
      "The register handler expects a single argument, the username",
    );
  }

  const userName = args[0];
  const checkUser = await getUserByName(userName);

  if (checkUser) {
    throw new Error("The user already exists. Check userName first");
  }

  try {
    const userCreated = await createUser(userName);

    if (!userCreated) {
      throw new Error("User was not created");
    }

    await setUser(userCreated.name);
    console.log(`User ${userName} created!`);
    console.log(userCreated);
  } catch (error) {
    throw error;
  }
}

export async function registerCommand(
  registry: CommandsRegistry,
  cmdName: string,
  handler: CommandHandler,
) {
  registry[cmdName] = handler;

  return;
}

export async function runCommand(
  registry: CommandsRegistry,
  cmdName: string,
  ...args: string[]
) {
  const handler = registry[cmdName];

  if (!handler) {
    throw new Error(
      `Unknown command: ${cmdName}. Available commands: ${Object.keys(registry).join(", ")}`,
    );
  }

  await handler(cmdName, ...args);
}
