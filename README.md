# Gator

Gator is a command-line RSS feed aggregator written in TypeScript. It lets multiple local users register, add RSS feeds, follow feeds added by others, and run a long-lived aggregator that periodically fetches feeds and stores their posts in PostgreSQL. Users can then browse the latest posts from the feeds they follow, right from the terminal.

Built as a guided project for [Boot.dev](https://www.boot.dev).

## Prerequisites

- **Node.js** 22 (the repository pins `22.15.0` in `.nvmrc`; run `nvm use` if you use nvm)
- **npm** (bundled with Node.js)
- **PostgreSQL** (a running server and a database Gator can connect to)

Everything else (`tsx`, `drizzle-orm`, `drizzle-kit`, `postgres`, `fast-xml-parser`) is installed through npm.

## Installation

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a PostgreSQL database for Gator, for example:

   ```bash
   createdb gator
   ```

   or, from `psql`:

   ```sql
   CREATE DATABASE gator;
   ```

3. Create the config file described in [Configuration](#configuration). The migration tooling (`drizzle.config.ts`) reads the database URL from it, so it must exist before the next step.

4. Apply the database migrations:

   ```bash
   npm run migrate
   ```

   This runs `drizzle-kit migrate` and creates the `users`, `feeds`, `feeds_follows` and `posts` tables from the migrations in `src/lib/db/migrations`.

   If you change `src/lib/db/schema.ts`, generate a new migration with `npm run generate` and then run `npm run migrate` again.

## Configuration

Gator reads its configuration from a JSON file in your home directory:

```
~/.gatorconfig.json
```

The file must contain both properties, and both must be strings:

| Property            | Description                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `db_url`            | PostgreSQL connection string used by the CLI and by the migration tooling.                                               |
| `current_user_name` | The user that is currently logged in. Gator updates it on `register` and `login`. Use an empty string before the first user exists. |

Example (replace the placeholders with your own values):

```json
{
  "db_url": "postgres://<username>:<password>@localhost:5432/gator?sslmode=disable",
  "current_user_name": ""
}
```

Do not commit this file; it lives outside the repository and contains your database credentials.

## Usage

Run Gator through the `start` script, which executes `src/index.ts` with `tsx`:

```bash
npm run start -- <command> [arguments]
```

The `--` makes npm pass the remaining arguments to Gator. A typical first session looks like this:

```bash
npm run start -- register alice
npm run start -- addfeed "Hacker News" https://news.ycombinator.com/rss
npm run start -- agg 1m          # leave running, stop with Ctrl+C
npm run start -- browse 5        # in another terminal
```

Available npm scripts:

| Script             | What it does                                         |
| ------------------ | ---------------------------------------------------- |
| `npm run start`    | Runs the Gator CLI (`tsx ./src/index.ts`).           |
| `npm run generate` | Generates SQL migrations from the schema (`drizzle-kit generate`). |
| `npm run migrate`  | Applies pending migrations to the database (`drizzle-kit migrate`). |

## Available Commands

Commands marked **login required** run as the user in `current_user_name` and fail if that user does not exist in the database.

| Command    | Arguments          | Login required | Description |
| ---------- | ------------------ | :------------: | ----------- |
| `register` | `<username>`       |                | Creates a new user and logs in as that user. Fails if the name is already taken. |
| `login`    | `<username>`       |                | Sets an existing user as the current user. |
| `users`    | none               |                | Lists all users and marks the current one with `(current)`. |
| `reset`    | none               |                | Deletes all users. Feeds, follows and posts are removed with them (cascade delete). Intended for development. |
| `addfeed`  | `<name> <url>`     | yes            | Adds an RSS feed and automatically follows it as the current user. |
| `feeds`    | none               |                | Lists every feed with its name, URL and the user who added it. |
| `follow`   | `<url>`            | yes            | Follows an existing feed by URL. The feed must have been added with `addfeed` first. |
| `following`| none               | yes            | Lists the names of the feeds the current user follows. |
| `unfollow` | `<url>`            | yes            | Stops following the feed with the given URL. |
| `agg`      | `<interval>`       |                | Starts the aggregator: fetches the least recently fetched feed immediately, then one feed per interval, saving new posts. Runs until you press Ctrl+C. |
| `browse`   | `[limit]`          | yes            | Shows the most recent posts from the feeds the current user follows, newest first. `limit` defaults to `2`. |

### `agg` interval format

The interval is a whole number followed by a unit, with no spaces: `ms`, `s`, `m` or `h`. Examples: `500ms`, `30s`, `1m`, `1h`.

Each tick fetches one feed (the one with the oldest, or no, `last_fetched_at`), so with several feeds it takes several intervals to refresh them all. Pick an interval that doesn't hammer the feed servers.

### Examples

```bash
npm run start -- login alice
npm run start -- users
npm run start -- feeds
npm run start -- follow https://news.ycombinator.com/rss
npm run start -- following
npm run start -- unfollow https://news.ycombinator.com/rss
npm run start -- browse 10
```
