import { CONSENT_VERSION, PROFILE_LOOKUP_URL, isGlobalLeaderboardConfigured } from "./config.js";
import { getGlobalDatabase, id } from "./instant-runtime.js";
import { leaderboardPeriod, normalizeHandle, utcDailyTotals } from "./periods.js";

export { CONSENT_VERSION, isGlobalLeaderboardConfigured };

function requireDatabase() {
  const database = getGlobalDatabase();
  if (!database) throw new Error("The global leaderboard has not been configured yet.");
  return database;
}

export function subscribeGlobalAuth(callback) {
  const database = getGlobalDatabase();
  if (!database) {
    callback({ isLoading: false, user: null, error: null });
    return () => {};
  }
  return database.subscribeAuth(callback);
}

export async function sendLoginCode(email) {
  return requireDatabase().auth.sendMagicCode({ email: String(email).trim() });
}

export async function signInWithCode(email, code) {
  return requireDatabase().auth.signInWithMagicCode({
    email: String(email).trim(),
    code: String(code).trim(),
  });
}

export async function signOutGlobal() {
  return requireDatabase().auth.signOut();
}

export async function getCurrentGlobalUser() {
  return requireDatabase().getAuth();
}

export async function getProfileForOwner(ownerId) {
  if (!ownerId) return null;
  const result = await requireDatabase().queryOnce({
    profiles: { $: { where: { ownerId } } },
  });
  return result.data.profiles?.[0] || null;
}

export async function lookupXProfile(rawHandle) {
  const handle = normalizeHandle(rawHandle);
  if (!handle) throw new Error("Enter a valid X handle or profile link.");
  if (!PROFILE_LOOKUP_URL) {
    return { handle, displayName: handle, avatarUrl: "", xUserId: "", profileFetched: false };
  }
  const requestUrl = new URL(PROFILE_LOOKUP_URL);
  requestUrl.searchParams.set("handle", handle);
  const response = await fetch(requestUrl);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 404 || response.status === 400) {
      throw new Error(result.error || "That X profile could not be found.");
    }
    return { handle, displayName: handle, avatarUrl: "", xUserId: "", profileFetched: false };
  }
  return {
    handle: normalizeHandle(result.handle) || handle,
    displayName: String(result.displayName || result.handle || handle).slice(0, 80),
    avatarUrl: /^https:\/\//.test(result.avatarUrl || "") ? result.avatarUrl : "",
    xUserId: /^\d{1,24}$/.test(String(result.xUserId || "")) ? String(result.xUserId) : "",
    profileFetched: true,
  };
}

export async function joinGlobalLeaderboard(profile, consentAccepted) {
  if (!consentAccepted) throw new Error("Consent is required to join the public leaderboard.");
  const database = requireDatabase();
  const user = await database.getAuth();
  if (!user) throw new Error("Sign in before joining the public leaderboard.");
  const handle = normalizeHandle(profile?.handle || profile);
  if (!handle) throw new Error("Enter a valid X handle.");

  const existing = await getProfileForOwner(user.id);
  const claimedResult = await database.queryOnce({
    profiles: { $: { where: { handleLower: handle.toLowerCase() } } },
  });
  const claimedProfile = claimedResult.data.profiles?.[0] || null;
  if (claimedProfile && claimedProfile.ownerId !== user.id) {
    throw new Error("That X handle has already been claimed on Time on X.");
  }
  const profileId = existing?.id || id();
  const publicId = existing?.publicId || profileId;
  const now = Date.now();
  await database.transact(database.tx.profiles[profileId].update({
    ownerId: user.id,
    publicId,
    handle,
    handleLower: handle.toLowerCase(),
    displayName: String(profile?.displayName || handle).slice(0, 80),
    avatarUrl: String(profile?.avatarUrl || "").slice(0, 600),
    xUserId: String(profile?.xUserId || "").slice(0, 24),
    public: true,
    consentVersion: CONSENT_VERSION,
    consentedAt: existing?.consentedAt || now,
    updatedAt: now,
    lastSyncedAt: existing?.lastSyncedAt || 0,
  }));
  return getProfileForOwner(user.id);
}

export function subscribeLeaderboard(periodType, callback) {
  const database = getGlobalDatabase();
  if (!database) {
    callback({ data: { profiles: [], dailyTotals: [] }, error: null, period: leaderboardPeriod(periodType) });
    return () => {};
  }
  const period = leaderboardPeriod(periodType);
  return database.subscribeQuery({
    profiles: {},
    dailyTotals: {
      $: {
        where: {
          date: { $gte: period.startKey, $lte: period.endKey },
        },
      },
    },
  }, (result) => callback({ ...result, period }));
}

export async function syncPublicTotals(sessions, now = Date.now()) {
  const database = getGlobalDatabase();
  if (!database) return { ok: false, reason: "not-configured" };
  const user = await database.getAuth();
  if (!user) return { ok: false, reason: "signed-out" };
  const profile = await getProfileForOwner(user.id);
  if (!profile?.public || profile.consentVersion !== CONSENT_VERSION) {
    return { ok: false, reason: "no-consent" };
  }

  const year = leaderboardPeriod("yearly", now);
  const syncStart = year.start;
  const daysSoFar = Math.floor((now - syncStart) / 86_400_000) + 1;
  const localRows = utcDailyTotals(sessions, now, daysSoFar);
  const remoteResult = await database.queryOnce({
    dailyTotals: {
      $: { where: { ownerId: user.id, date: { $gte: year.startKey, $lte: year.endKey } } },
    },
  });
  const remoteByDate = new Map(
    (remoteResult.data.dailyTotals || []).map((row) => [row.date, row]),
  );
  const changedRows = localRows.filter((row) => {
    const remote = remoteByDate.get(row.date);
    const localDuration = Math.round(row.durationMs);
    return (localDuration > 0 || remote) && Number(remote?.durationMs || 0) !== localDuration;
  });
  for (const row of changedRows) {
    const key = `${profile.publicId}:${row.date}`;
    const payload = {
      key,
      ownerId: user.id,
      publicId: profile.publicId,
      date: row.date,
      durationMs: Math.max(0, Math.min(86_400_000, Math.round(row.durationMs))),
      updatedAt: now,
    };
    let dailyTotalId = remoteByDate.get(row.date)?.id || id();
    const write = () => database.transact(
      database.tx.dailyTotals[dailyTotalId]
        .update(payload)
        .link({ profile: profile.id }),
    );

    try {
      await write();
    } catch (error) {
      const message = error?.body?.message || error?.message || "";
      if (!/unique/i.test(message)) throw error;
      const latestResult = await database.queryOnce({
        dailyTotals: { $: { where: { key } } },
      });
      const latest = latestResult.data.dailyTotals?.[0] || null;
      if (!latest || latest.ownerId !== user.id || latest.publicId !== profile.publicId) throw error;
      dailyTotalId = latest.id;
      await write();
    }
  }
  await database.transact(database.tx.profiles[profile.id].update({ lastSyncedAt: now, updatedAt: now }));
  return { ok: true, changed: changedRows.length, syncedAt: now };
}

export async function leaveGlobalLeaderboard() {
  const database = requireDatabase();
  const user = await database.getAuth();
  if (!user) throw new Error("You are not signed in.");
  const result = await database.queryOnce({
    profiles: { $: { where: { ownerId: user.id } } },
    dailyTotals: { $: { where: { ownerId: user.id } } },
  });
  const deletes = [
    ...(result.data.dailyTotals || []).map((row) => database.tx.dailyTotals[row.id].delete()),
    ...(result.data.profiles || []).map((profile) => database.tx.profiles[profile.id].delete()),
  ];
  for (let index = 0; index < deletes.length; index += 100) {
    await database.transact(deletes.slice(index, index + 100));
  }
  return { ok: true, deletedTotals: result.data.dailyTotals?.length || 0 };
}

export function globalErrorMessage(error) {
  const message = error?.body?.message || error?.message || "The leaderboard request failed.";
  if (/already been claimed/i.test(message)) return "That X handle has already been claimed on Time on X.";
  if (/unique/i.test(message)) return "A public record changed while syncing. Please try again.";
  if (/rate.?limit/i.test(message)) return "Too many requests. Please wait a moment and try again.";
  return message;
}
