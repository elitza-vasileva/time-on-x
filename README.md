# Time on X

Time on X is a Chrome extension that measures the time a person is actually viewing and recently interacting with X (`x.com` or `twitter.com`). It combines private on-device analytics with an optional, consent-based public leaderboard.

The repository also includes a Vercel-ready website with a public landing page, live rankings, and a signed-in dashboard for consented daily totals synced by the extension.

## What is included

- Active-tab, frontmost-window, page-visibility, computer-idle, and recent-interaction checks
- Today, hourly bars, an activity timeline, weekly/monthly trends, and a 12-month activity map
- Share-card PNG generation, CSV export, and JSON backup/restore
- Optional public rankings for the current UTC day, Monday–Sunday week, calendar month, and calendar year
- InstantDB magic-code sign-in and explicit leaderboard consent
- Public X handle with optional ScrapeCreators name/avatar enrichment, clickable X profiles, daily aggregate sync, and complete cloud-data deletion
- Dedicated Activity, Rankings, and Settings pages with System, Light, and Dark themes

Exact visit timestamps always remain in `chrome.storage.local`. A participant publishes only one aggregate duration per UTC day plus the public profile fields described in [PRIVACY.md](PRIVACY.md).

## Install the current local build

1. Run `npm install` and `npm run build`.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode**.
4. Click **Load unpacked** and choose this project folder.
5. Pin Time on X, open X, and refresh any X tabs that were already open.

The local tracker works even before InstantDB is configured. The dashboard displays a cloud-setup message until an app ID is added.

For sharing the pre-store beta with testers, use [docs/BETA_INSTALL.md](docs/BETA_INSTALL.md).

## Configure public rankings

Follow [docs/GLOBAL_SETUP.md](docs/GLOBAL_SETUP.md). In short, the publisher must provide:

1. an InstantDB production app ID;
2. access to push the included schema and permissions;
3. public privacy-policy/support URLs and a monitored support email; and
4. a Chrome Web Store publisher account for official distribution.

The InstantDB app ID is public client configuration. Never place an Instant admin token inside the extension.

## What counts as time

A visit counts only while the X page is the selected tab in the frontmost, non-minimized Chrome window; the page is visible and active; the computer is active and unlocked; and the page received a recent trusted mouse, keyboard, scroll, wheel, or touch interaction.

Switching tabs or apps, minimizing Chrome, hiding/navigating away, locking the computer, or reaching the selected inactivity timeout ends the visit. The extension does not record keys, pointer coordinates, feed content, posts, messages, searches, or page titles.

## Development

```powershell
npm install
npm test
npm run build
npm run package
npm run build:web
```

`npm run package` creates `dist/time-on-x-extension-v1.5.3.zip`. The official InstantDB SDK is bundled into the package; no JavaScript is loaded from a remote server at runtime.

`npm run build:web` creates the static Vercel output in `web-dist`, including the public privacy policy at `/privacy/`. Vercel uses the root `vercel.json` and needs no secret for the public InstantDB app ID. The web dashboard displays daily aggregates only; exact visits and hourly details remain local to the extension.

See [docs/WEB_DEPLOYMENT.md](docs/WEB_DEPLOYMENT.md) for the first Vercel deployment checklist and route details.

See [docs/TESTING.md](docs/TESTING.md) for manual checks and [docs/PUBLISHING.md](docs/PUBLISHING.md) for the Chrome Web Store checklist.

## Repository map

- `service-worker.js` — tracking state machine and periodic aggregate sync
- `content-script.js` — interaction and visibility signals without page-content access
- `lib/` — local storage model and analytics
- `global/` — leaderboard periods, InstantDB client, and public sync logic
- `instant.schema.ts` / `instant.perms.ts` — production data model and access controls
- `server/` — optional ScrapeCreators profile proxy; its API key never enters the extension
- `store-assets/` — prepared 1280×800 screenshot and 440×280 promotional tile
- `popup/`, `dashboard/`, `leaderboard/`, and `settings/` — extension interfaces
- `web/` — landing page, public rankings, and signed-in aggregate dashboard
- `vercel.json` — Vercel build and output configuration
- `tests/` — deterministic tracker and leaderboard tests

## License

MIT — see [LICENSE](LICENSE).
