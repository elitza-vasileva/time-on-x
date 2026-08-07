# Chrome Web Store publishing checklist

## Publisher prerequisites

1. Register a Chrome Web Store developer account, pay Google's one-time registration fee, and enable 2-step verification.
2. Choose a permanent publisher/legal name and a monitored support email.
3. Host `PRIVACY.md` at a public HTTPS URL and replace both placeholders in it.
4. Provide a product/support URL. A small public website or GitHub Pages site is sufficient.
5. Complete [GLOBAL_SETUP.md](GLOBAL_SETUP.md), including the final InstantDB app, permissions, reviewer account, and—if used—profile service.

## Build and test

1. Run `npm test` and the checks in `TESTING.md`.
2. Run `npm run package`.
3. Inspect `dist/time-on-x-extension-v1.5.2.zip`; never include `.env`, InstantDB admin credentials, the ScrapeCreators key, or `node_modules`.
4. Upload the ZIP as a draft. Google assigns the permanent extension ID before publication.
5. If profile lookup is enabled, allow the permanent `chrome-extension://ID` origin in the Worker, re-run configuration with the final endpoint, rebuild, and replace the draft ZIP.

Every later upload must increment the manifest version. Each submitted version is reviewed; it is not public until Google approves it.

## Suggested store listing

**Name:** Time on X

**Summary (132 characters maximum):** Track active time on X with timelines, trends, share cards, dark mode, and optional public rankings.

**Category:** Productivity

**Single purpose:** Time on X measures and visualizes active time spent viewing X and, with consent, compares daily aggregate totals on a public leaderboard.

**Detailed description:**

Time on X counts only when X is the visible tab in the frontmost window and you have interacted recently. Explore hourly activity, a visual timeline, weekly and monthly patterns, a 12-month activity map, exports, backups, dark mode, and shareable cards. Public daily, Monday–Sunday weekly, calendar-month, and calendar-year rankings are optional. Joining requires sign-in and explicit consent; raw visit timestamps stay on the device.

## Permission justifications

- **x.com / twitter.com:** receives visibility and recent-interaction signals needed to measure active viewing; no feed, post, message, search, or keystroke content is collected.
- **api.instantdb.com:** supports optional magic-code authentication, consented daily-aggregate sync/deletion, and public leaderboard reads.
- **Configured profile-service host:** retrieves public X name/avatar fields only after a participant enters a handle.
- **storage:** retains local visits, settings, and tracker state.
- **idle:** excludes locked or computer-idle time.
- **alarms:** closes stale visits and periodically syncs only for consenting participants.

## Privacy practices declarations

Disclose at least:

- Personally identifiable information: email address, X handle, public display name/avatar, X account ID, and authentication identifiers.
- Web history/activity: timestamps and aggregate duration associated with active use of X.
- Authentication information: magic-code authentication state/token handling.
- Website content: select only if the dashboard asks because host interaction signals are treated as website/browser activity; explain that content itself is not read.

Certify Limited Use only if the final behavior and hosted privacy policy match these statements. Declare that public profile fields and daily totals are shared publicly only after explicit consent. Do not describe the extension as entirely local once the leaderboard is enabled.

## Store assets

- 128×128 store icon: `icons/icon-128.png`
- Prepared 1280×800 screenshot: `store-assets/time-on-x-store-screenshot-1-1280x800.png`
- Prepared 440×280 small promotional tile: `store-assets/time-on-x-small-promo-440x280.png`
- Optional 1400×560 marquee image
- Public privacy-policy URL
- Support email and support/product URL
- Reviewer instructions and InstantDB test email/fixed magic code

Use demonstration data in screenshots and avoid exposing a real participant's email or visit history.
