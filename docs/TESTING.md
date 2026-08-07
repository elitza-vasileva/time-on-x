# Manual acceptance test

Run `npm test`, then load the unpacked extension from `chrome://extensions`. Refresh any X tab that was already open.

## Tracking behavior

1. Open X as the active tab in the frontmost Chrome window.
2. Move the pointer or scroll, wait at least ten seconds, then switch to a different tab.
3. Open the dashboard. Confirm one visit appears with the expected start/end times and roughly the expected duration.
4. Leave X active without interacting for longer than the selected inactivity timeout. Confirm the green tracking status changes to **Not tracking** and the visit stops at the timeout.
5. Interact with X again. Confirm a new visit begins instead of extending the expired visit.
6. Verify tracking stops when each of the following occurs: another Chrome tab is selected, another application is frontmost, Chrome is minimized, the computer locks, or the X tab navigates to a non-X site.
7. Open two Chrome windows with X in one. Confirm only the active tab in the frontmost window can count.
8. Leave X open for at least one minute while continuing to interact. Confirm worker wakeups do not fragment it into many visits.
9. Click X search, links, and buttons that move keyboard focus within the page. Confirm those internal focus changes stay in the same visit.

## Analytics and data

1. Confirm the popup and dashboard totals agree.
2. Confirm a visit appears in the correct hourly bar and exact timeline position.
3. Switch the trend between **7 days**, **30 days**, and **12 weeks**. Confirm the number of bars, total, date range, and previous-period comparison update.
4. Use the trend's previous/next controls and confirm **Next** is disabled for the current period.
5. Use previous/next date navigation and the date picker.
6. Export CSV and inspect its start, end, and duration fields.
7. Export JSON, clear all data, then restore the JSON backup.
8. Change the inactivity timeout and confirm it persists after restarting Chrome.
9. Hover hourly, trend, timeline, and activity-map marks and confirm the tooltip shows the exact date/time and duration.
10. Generate share cards for Today, 7 days, 30 days, and a custom range. Download a PNG and test the X sharing flow.

## Public leaderboard

Use the production-like InstantDB schema and permissions, but test with non-personal accounts.

1. While signed out, confirm daily, weekly, monthly, and yearly rankings are readable and the join steps/email prompt are prominent.
2. Send and verify a magic code. Confirm the email never appears in the public row or database query available to signed-out users.
3. Enter an invalid handle and confirm it is rejected. Enter a valid handle and confirm name/avatar preview loads when the profile service is configured, or that the initial fallback appears when it is unavailable.
4. Join only after selecting the consent checkbox. Confirm joining is blocked without consent.
5. Confirm the current UTC day total appears and the user's row is highlighted.
6. Confirm weekly totals start Monday UTC, monthly totals start on the first UTC day of the month, and yearly totals start January 1 UTC.
7. Keep X active, wait for sync or click **Sync now**, and confirm only the changed daily aggregate is updated.
8. Sign in with a second account and confirm it cannot change or delete the first account's profile/totals.
9. Try to claim the first account's handle with different letter casing and confirm the unique-handle error appears.
10. Click **Leave & delete public data** and confirm the profile and every daily total disappear while local visit history remains.
11. Confirm signing out stops future sync but does not claim to delete already-public data.
12. Confirm every leaderboard row opens the correct `x.com/HANDLE` profile in a new tab.
13. Confirm no response, client-visible log, ZIP file, or source file contains an Instant admin token or ScrapeCreators API key.

## Release checks

1. Open `chrome://extensions`, enable **Collect errors**, and complete the tracking test with no extension errors.
2. Inspect the popup at 100%, 125%, and 150% browser scaling.
3. Inspect the dashboard at 760 px and desktop widths.
4. Run `npm run package`, extract the ZIP to a temporary folder, and load that folder as an unpacked extension for a final smoke test.
5. Use the InstantDB fixed reviewer code to test authentication from the packaged build.
6. Monitor DevTools Network and confirm personal data is transmitted only to the exact HTTPS hosts declared in the manifest and privacy policy.
7. Switch System, Light, and Dark themes; confirm each selection changes immediately and persists after closing and reopening the page.
