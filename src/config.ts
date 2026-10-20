import fs from "fs";
import os from "os";
import path from "path";

export type Config = {
  dbUrl: string;
  currentUserName: string;
};

export function setUser(userName: string): void {
  const filePath = getConfigFilePath();

  const configFile = fs.readFileSync(filePath, "utf-8");

  const parsedConfigFile = JSON.parse(configFile);

  parsedConfigFile.current_user_name = userName;

  const validatedConfigFile = validateConfig(parsedConfigFile);

  writeConfig(validatedConfigFile);
}

export function readConfig(): Config {
  const filePath = getConfigFilePath();

  const configFile = fs.readFileSync(filePath, "utf-8");

  const rawConfig = JSON.parse(configFile);

  return validateConfig(rawConfig);
}

function getConfigFilePath(): string {
  const homeDir = os.homedir();
  return `${homeDir}/.gatorconfig.json`;
}

function writeConfig(cfg: Config): void {
  const filePath = getConfigFilePath();

  const configFile = {
    db_url: cfg.dbUrl,
    current_user_name: cfg.currentUserName,
  };

  fs.writeFileSync(filePath, JSON.stringify(configFile));
}

function validateConfig(rawConfig: any): Config {
  if (typeof rawConfig.db_url !== "string") {
    throw new Error(
      "db_url must be a string. Config file doesn't correspond to our Config type",
    );
  }

  if (typeof rawConfig.current_user_name !== "string") {
    throw new Error(
      "current_user_name must be a string. Config file doesn't correspond to our Config type",
    );
  }

  return {
    dbUrl: rawConfig.db_url,
    currentUserName: rawConfig.current_user_name,
  };
}
