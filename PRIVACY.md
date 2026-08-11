# Time on X Privacy Policy

**Effective date:** July 22, 2026

**Last updated:** August 12, 2026

Time on X measures active time spent on X and provides private analytics. A user may separately choose to publish limited profile information and daily time totals on the Time on X public leaderboard. Participation is optional and requires affirmative consent inside the extension.

## Information handled locally

Time on X stores these items on the user's device:

- start and end timestamps for active, visible visits on `x.com` and `twitter.com`;
- the selected inactivity timeout and theme; and
- local extension and authentication state needed to operate the requested features.

Temporary mouse, keyboard, scroll, wheel, touch, focus, and visibility signals are used only to determine whether a visit is active. Time on X does not record event content, pressed keys, pointer coordinates, feed content, posts, direct messages, searches, page titles, passwords, or browsing activity outside X.

## Optional public leaderboard data

When a user signs in, enters an X handle, and accepts the leaderboard consent, Time on X sends the following data to the cloud:

- the email address used for private magic-code authentication;
- an InstantDB account identifier;
- the entered X handle and its lowercase lookup form;
- the public X display name, X account ID, and profile-image URL when profile enrichment succeeds;
- one aggregate duration for each UTC calendar day in the current year that has recorded or previously synced time;
- the consent-policy version and consent, update, and sync timestamps.

The email address and authentication identifier are not returned in public leaderboard queries. The X handle, public display name/profile image, link to the associated public X profile, and daily aggregate durations are publicly visible and are used to calculate daily, Monday–Sunday weekly, calendar-month, calendar-year, and community charts. Exact visit timestamps are never uploaded.

Leaderboard totals are self-reported by the installed extension. Entering an X handle does not, in the current version, prove ownership of that X account.

## Private payout analysis

A signed-in user may manually save an X revenue-sharing amount and its starting and ending dates. Time on X privately compares those records with the user's synced daily totals. Payout amounts, payout periods, calculated hourly rates, and correlation results are visible only to the authenticated owner and are never included in public rankings.

## Service providers and disclosure

- **InstantDB** provides authentication, database storage, access controls, and real-time leaderboard queries.
- **DataFast** provides cookieless website analytics for `timeonx.com`. It may process the visited page, referrer, browser and device metadata, network-derived pseudonymous signals, and session-only identifiers. Time on X does not send extension visit history, exact X activity, leaderboard email addresses, or X handles to DataFast.
- **Cloudflare** may host the profile-enrichment proxy.
- **ScrapeCreators** receives the entered X handle and retrieves current public X profile fields. The ScrapeCreators API key remains a server secret and is never included in the extension.
- Other Time on X users can see the public leaderboard fields described above.

Time on X does not sell user data, use it for personalized advertising, or provide it to data brokers. Data is used only to operate and secure the tracker, public rankings, exports, backups, and user-requested sharing features.

## Choice, retention, and deletion

Local visit history remains until the user clears it from Settings or uninstalls the extension. **Clear all data** deletes local visit history but does not by itself leave the optional public leaderboard.

A participating user can choose **Leave & delete public data** to delete their public profile and every associated daily total from InstantDB. Signing out only stops syncing on that device; it does not remove previously published data. Uninstalling the extension removes local data but may not remove previously published leaderboard data, so a participant should leave the leaderboard before uninstalling or contact support for deletion.

Private payout records remain until the owner deletes them from the web dashboard or requests deletion from support. Deleting public leaderboard data does not automatically delete private payout records.

Authentication records required for account operation and security may be retained by InstantDB according to the provider's terms. Infrastructure providers may also retain limited security and request logs under their own retention policies.

## Security

Personal and sensitive data is transmitted only over HTTPS or secure WebSocket connections. InstantDB administrative credentials and the ScrapeCreators API key are kept out of the extension. Database rules limit profile and total changes to the authenticated owner, validate daily-duration limits, prevent duplicate handles, block client-side schema changes, and rate-limit writes.

No internet service can guarantee absolute security. Users should report suspected issues using the contact information below.

## Chrome permissions

- **Access to `x.com` and `twitter.com`:** detects page visibility and recent interaction without reading page content.
- **Access to `api.instantdb.com`:** provides optional sign-in, consented aggregate sync, deletion, and public rankings.
- **Access to the configured profile service:** sends only a handle entered by the user and receives public X name/avatar fields.
- **Storage:** saves visit timestamps and settings locally.
- **Idle:** excludes computer-idle and locked time.
- **Alarms:** closes stale visits and periodically syncs consented daily aggregates.

## Limited use

Time on X's use and transfer of information received from browser APIs complies with the Chrome Web Store User Data Policy, including the Limited Use requirements. Information is used only to provide or improve the extension's prominent user-facing features, for security, to comply with law, or as otherwise permitted by that policy. It is not used for personalized advertising, creditworthiness, lending, or sale to third parties.

## Changes and contact

Material changes to data practices will be disclosed before new collection or sharing begins, and consent will be requested again when appropriate.

**Publisher:** El Dev Vision Ltd

**Support and deletion requests:** eldevvision@gmail.com
