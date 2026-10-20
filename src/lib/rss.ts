import { XMLParser } from "fast-xml-parser";

type RSSFeed = {
  channel: {
    title: string;
    link: string;
    description: string;
    item: RSSItem[];
  };
};

type RSSItem = {
  title: string;
  link: string;
  description?: string;
  pubDate?: string;
};

export async function fetchFeed(feedURL: string): Promise<RSSFeed> {
  const response = await fetch(feedURL, {
    headers: {
      "User-Agent": "gator",
    },
  });
  const data = await response.text();

  const parser = new XMLParser({
    processEntities: false,
  });

  const parsedData = parser.parse(data);

  if (!parsedData.rss?.channel) {
    throw new Error("Data doesn't contain channel");
  }

  const channel = parsedData.rss?.channel;

  if (!channel.title || typeof channel.title !== "string") {
    throw new Error("title field isn't a valid string");
  }

  if (!channel.link || typeof channel.link !== "string") {
    throw new Error("link field isn't a valid string");
  }
  if (!channel.description || typeof channel.description !== "string") {
    throw new Error("description field isn't a valid string");
  }

  const items = Array.isArray(channel.item)
    ? channel.item
    : channel.item
      ? [channel.item]
      : [];

  const validItems: RSSItem[] = [];

  for (const item of items) {
    // title y link son obligatorios; description y pubDate son opcionales
    if (
      !item.title ||
      typeof item.title !== "string" ||
      !item.link ||
      typeof item.link !== "string"
    ) {
      continue;
    }
    validItems.push({
      title: item.title,
      link: item.link,
      description:
        typeof item.description === "string" ? item.description : undefined,
      pubDate: typeof item.pubDate === "string" ? item.pubDate : undefined,
    });
  }
  return {
    channel: {
      title: channel.title,
      link: channel.link,
      description: channel.description,
      item: validItems,
    },
  };
}
