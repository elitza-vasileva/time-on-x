import {
  getProfileForOwner,
  globalErrorMessage,
  sendLoginCode,
  signInWithCode,
  signOutGlobal,
  subscribeGlobalAuth,
  subscribeLeaderboard,
} from "../../global/leaderboard-client.js";
import { getGlobalDatabase, id } from "../../global/instant-runtime-entry.js";

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
    callback({ data: { profiles: [], dailyTotals: [], payouts: [] }, error: null });
    return () => {};
  }
  return database.subscribeQuery({
    profiles: { $: { where: { ownerId } } },
    dailyTotals: { $: { where: { ownerId } } },
    payouts: { $: { where: { ownerId } } },
  }, callback);
}

export async function savePayoutPeriod({ startDate, endDate, amount }) {
  const database = getGlobalDatabase();
  if (!database) throw new Error("The dashboard database is not configured.");
  const user = await database.getAuth();
  if (!user) throw new Error("Sign in before saving a payout.");
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const start = String(startDate || "");
  const end = String(endDate || "");
  const amountCents = Math.round(Number(amount) * 100);
  const spanDays = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000;
  if (!datePattern.test(start) || !datePattern.test(end) || !Number.isFinite(spanDays) || spanDays <= 0 || spanDays > 93) {
    throw new Error("Choose a valid payout period between 1 and 93 days.");
  }
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > 100_000_000) {
    throw new Error("Enter a valid payout amount above $0.");
  }
  const key = `${user.id}:${start}:${end}`;
  const existingResult = await database.queryOnce({ payouts: { $: { where: { key } } } });
  const existing = existingResult.data.payouts?.[0] || null;
  const now = Date.now();
  await database.transact(database.tx.payouts[existing?.id || id()].update({
    key,
    ownerId: user.id,
    startDate: start,
    endDate: end,
    amountCents,
    currency: "USD",
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  }));
  return { updated: Boolean(existing) };
}

export async function deletePayoutPeriod(payoutId) {
  const database = getGlobalDatabase();
  if (!database) throw new Error("The dashboard database is not configured.");
  const user = await database.getAuth();
  if (!user) throw new Error("Sign in before deleting a payout.");
  await database.transact(database.tx.payouts[payoutId].delete());
}
