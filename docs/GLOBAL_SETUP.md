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

## Optional ScrapeCreators profile enrichment

The extension must never contain the ScrapeCreators API key. Deploy the included Cloudflare Worker and store the key as its secret:

1. Copy `server/wrangler.toml.example` to `server/wrangler.toml`.
2. Set `ALLOWED_ORIGINS` to the exact installed extension origin, such as `chrome-extension://EXTENSION_ID`. Add `http://127.0.0.1:8765` only during local testing.
3. From the `server` directory, authenticate to Cloudflare and add the secret:

```powershell
npx wrangler login
npx wrangler secret put SCRAPECREATORS_API_KEY
npx wrangler deploy
```

4. Configure the deployed `/profile` URL and rebuild:

```powershell
npm run configure:profile -- https://YOUR-WORKER.workers.dev/profile
npm run package
```

The Worker sends only the entered handle to ScrapeCreators, returns name/avatar/account ID, restricts browser origins, and caches successful profiles for 24 hours to reduce credit usage. If the service is unavailable, joining still falls back to the typed handle and an initial avatar.

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
