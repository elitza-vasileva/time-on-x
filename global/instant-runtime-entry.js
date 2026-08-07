import { id, init } from "@instantdb/core";
import { INSTANT_APP_ID, isGlobalLeaderboardConfigured } from "./config.js";

let database;

export function getGlobalDatabase() {
  if (!isGlobalLeaderboardConfigured()) return null;
  if (!database) {
    database = init({ appId: INSTANT_APP_ID, devtool: false });
  }
  return database;
}

export { id };
