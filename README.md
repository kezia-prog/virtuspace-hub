# VirtuSpace Daily Hub

Team hub for VirtuSpace virtual assistants: daily top-3 priorities, time logging per client, team announcements, weekly reports, branded TT$ invoices, and automatic overdue reminders — styled to virtuspacett.com.

## What's inside
- public/            the web app (sign-in, Today, Time log, Team, Reports, Admin)
- netlify/functions/api.mts        the API (accounts, data, invoices, admin)
- netlify/functions/reminders.mts  runs daily 8:00 AM Trinidad time: >2 days
                                   without logging = in-app notice + reminder
                                   email with a link back to the hub
- Data is stored in Netlify Blobs — no database needed.

## Deploy (pick one)

A) Netlify CLI — from inside this folder:
   npm install
   npx netlify login
   npx netlify init          (create new site, e.g. virtuspace-hub)
   npx netlify deploy --prod

B) GitHub: push this folder to a repo, then Netlify > Add new project >
   Import from Git. All build settings are already in netlify.toml.
   No build command needed.

(Netlify Drop / drag-and-drop won't work — this project has serverless
functions, which Drop doesn't support.)

## Environment variables (Site settings > Environment variables)
RESEND_API_KEY   for email    free key from resend.com; enables invite +
                              reminder emails. Without it the app still works,
                              reminders just stay in-app only.
FROM_EMAIL       optional     e.g. "VirtuSpace Hub <hub@virtuspacett.com>"
                              (verify virtuspacett.com in Resend first).
                              Note: until the domain is verified, Resend's
                              default sender can only email the account owner.
HOURLY_RATE      optional     invoice rate, default 30 (TT$/hr). Never shown
                              in the app.
APP_URL          optional     link used in emails; defaults to the site URL.

## First run
1. Deploy, open the site, tap "Set up your account".
2. IMPORTANT — do this immediately: the very FIRST account setup after deploy
   needs no invite code. Use kezia@virtuspacett.com, choose your password.
   That's your admin account.
3. Every account after that needs its invite code. From your Admin tab:
   "Copy invite link" for each VA (or, with Resend configured, "Add & invite"
   emails it automatically). The five VAs are pre-seeded:
   Khadijah White, Abigayle Shade, Sadie Mohammed, Candice Greenidge, Kezia Figaro.
4. Each VA opens her link, sets a password, done.

## Admin tab
Add/remove VAs, copy invite links, reset passwords, send an instant reminder
to anyone overdue, and manage the shared client list.
