import {
  getProfileForOwner,
  globalErrorMessage,
  sendLoginCode,
  signInWithCode,
  signOutGlobal,
  subscribeGlobalAuth,
  subscribeLeaderboard,
} from "../../global/leaderboard-client.js";
import { getGlobalDatabase } from "../../global/instant-runtime-entry.js";

export {
  getProfileForOwner,
  globalErrorMessage,
  sendLoginCode,
  signInWithCode,
  signOutGlobal,
  subscribeGlobalAuth,
  subscribeLeaderboard,
};

export function subscribeOwnerDashboard(ownerId, callback) {
  const database = getGlobalDatabase();
  if (!database || !ownerId) {
    callback({ data: { profiles: [], dailyTotals: [] }, error: null });
    return () => {};
  }
  return database.subscribeQuery({
    profiles: { $: { where: { ownerId } } },
    dailyTotals: { $: { where: { ownerId } } },
  }, callback);
}
