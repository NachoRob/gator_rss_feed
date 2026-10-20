import type { CommandHandler, UserCommandHandler } from "../commands.js";
import { readConfig } from "../config.js";
import { getUserByName } from "../lib/db/queries/users.js";

export function middlewareLoggedIn(
  handler: UserCommandHandler,
): CommandHandler {
  return async (cmdName: string, ...args: string[]): Promise<void> => {
    const config = readConfig();

    const currentUserName = config.currentUserName;
    if (!currentUserName) {
      throw new Error("No username found in config file");
    }

    const user = await getUserByName(currentUserName);

    if (!user) {
      throw new Error(`User ${currentUserName} not found`);
    }

    await handler(cmdName, user, ...args);
  };
}
