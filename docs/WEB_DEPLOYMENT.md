# Vercel website deployment

The website is a static Vercel build generated from the `web` source directory.

## Before the first public deployment

1. Confirm that `eldevvision@gmail.com` remains the monitored support and deletion-request address.
2. Confirm the production InstantDB schema and permissions have been pushed for app `98a6542b-b4c9-4a76-81b0-d4bc03e95de7`.
3. Keep profile scraping disabled. The website displays self-declared handles and generated initials only.
4. Host the final privacy policy and link it from the footer before inviting external users.

## Deploy through the Vercel dashboard

1. Push this repository to a Git provider supported by Vercel.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Leave the root directory as the repository root.
4. Vercel will read `vercel.json`, run `npm run build:web`, and publish `web-dist`.
5. After the first deployment, add the selected custom domain in **Project Settings → Domains**.

No private InstantDB or X credentials belong in Vercel. The InstantDB app ID is a public client identifier and is already included in the browser bundle.

## What the website can display

- `/` — landing page and a live preview of the daily public rankings.
- `/rankings/` — public daily, Monday–Sunday weekly, calendar-month, and calendar-year rankings.
- `/dashboard/` — magic-code sign-in and the current user's synced daily totals, 30-day trend, and yearly activity map.

- `/privacy/` — public privacy policy for website visitors and the Chrome Web Store listing.

The website cannot display hourly activity or exact visit timestamps because those remain in the extension's local Chrome storage. Supporting those views later would require a separate consented aggregate-sync design.
