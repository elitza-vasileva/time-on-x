# Public rankings deployment

## InstantDB setup

The production app ID is already configured in `global/config.js`. The public client ID is safe to ship; never put an InstantDB admin token in the extension.

1. Authenticate from this repository:

```powershell
npx instant-cli@latest login
```

2. Push the included schema and permissions:

```powershell
npx instant-cli@latest push schema --app 98a6542b-b4c9-4a76-81b0-d4bc03e95de7
npx instant-cli@latest push perms --app 98a6542b-b4c9-4a76-81b0-d4bc03e95de7
```

3. Keep email magic-code authentication enabled in InstantDB Auth. Create a fixed test email/code for Chrome Web Store review.
4. Run `npm test` and `npm run package`.

## ScrapeCreators profile enrichment

The extension never contains the ScrapeCreators API key. Profile requests go through the Vercel Function at `https://timeonx.com/api/profile`.

1. In the Time on X Vercel project, open **Settings → Environment Variables**.
2. Add `SCRAPECREATORS_API_KEY` with the secret from ScrapeCreators.
3. Add `PROFILE_ALLOWED_ORIGINS` with the exact installed extension origin, such as `chrome-extension://EXTENSION_ID`. Multiple exact origins may be comma-separated during testing.
4. Apply both variables to Production and redeploy.

The endpoint sends only the normalized handle to ScrapeCreators, returns public name/avatar/account ID, and asks ScrapeCreators to reuse profile data cached within seven days so repeated lookups can cost zero credits. If the service is unavailable, joining falls back to the typed handle and an initial avatar.

The older Cloudflare Worker in `server/profile-worker.js` remains available as an alternative deployment target.

## Published data and ranking behavior

- A participant signs in privately, types an X handle, and explicitly consents.
- Optional profile enrichment retrieves the current public name, avatar, and X account ID through the server-side ScrapeCreators proxy.
- The public leaderboard links each participant to `https://x.com/HANDLE`.
- Handle ownership is not verified.
- Raw visit timestamps remain in Chrome local storage.
- Only changed UTC daily totals are synced, from January 1 through today.
- Daily rankings use the current UTC day.
- Weekly rankings use Monday through Sunday in UTC.
- Monthly and yearly rankings use UTC calendar boundaries.
- Week, month, year, and community charts are calculated from daily rows.
- Sync runs at startup, every 15 minutes, after restore/clear, and on request.

Users can modify their own browser and falsify self-reported time. Describe this as a community leaderboard, not a verified competition.

## Production checks

- Test two email accounts and confirm each can change only its own records.
- Confirm unauthenticated visitors can read but not write.
- Confirm duplicate lowercase handles are rejected.
- Confirm a daily total cannot exceed 86,400,000 ms.
- Confirm **Leave & delete public data** removes the profile and all its totals.
- Confirm year, month, week, and day selectors use the correct UTC boundaries.
