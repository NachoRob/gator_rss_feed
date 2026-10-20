import { conn } from "./lib/db/index.js";
import { middlewareLoggedIn } from "./middleware/loggedIn.js";
import {
  CommandsRegistry,
  registerCommand,
  handlerLogin,
  handlerRegister,
  handlerReset,
  handlerGetUsers,
  handlerAgg,
  handlerAddFeed,
  handlerFeeds,
  handlerFollowing,
  handlerFollow,
  handlerUnfollow,
  handlerBrowse,
  runCommand,
} from "../src/commands.js";

async function main() {
  try {
    const registry: CommandsRegistry = {};

    registerCommand(registry, "login", handlerLogin);
    registerCommand(registry, "register", handlerRegister);
    registerCommand(registry, "reset", handlerReset);
    registerCommand(registry, "users", handlerGetUsers);
    registerCommand(registry, "agg", handlerAgg);
    registerCommand(registry, "addfeed", middlewareLoggedIn(handlerAddFeed));
    registerCommand(registry, "feeds", handlerFeeds);
    registerCommand(
      registry,
      "following",
      middlewareLoggedIn(handlerFollowing),
    );
    registerCommand(registry, "follow", middlewareLoggedIn(handlerFollow));
    registerCommand(registry, "unfollow", middlewareLoggedIn(handlerUnfollow));
    registerCommand(registry, "browse", middlewareLoggedIn(handlerBrowse));

    const args = process.argv.slice(2);

    const cmdName = args[0];
    const cmdArgs = args.slice(1);

    if (!cmdName) {
      throw new Error("A command is required.");
    }

    await runCommand(registry, cmdName, ...cmdArgs);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }

    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}

main();
