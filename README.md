# Wedding Guests for Hire

A Vercel-hosted management-finance app for the Friends Included Ltd homework. Supabase is the source of truth; the app synchronizes readable Sales and Expenses sheets and accepts Telegram submissions.

## What you must create outside this folder

1. A Supabase project. Open **SQL Editor**, run `supabase/schema.sql`, then copy the project URL and **service_role** key.
2. A Google Cloud service account with the Google Sheets API enabled. Create a blank spreadsheet with tabs called `Sales` and `Expenses`, and share it with the service-account email as **Editor**.
3. A Telegram bot from [@BotFather](https://t.me/BotFather). It must be started in a private chat before testing.
4. A GitHub repository and a Vercel project.

## Configure locally

```bash
cp .env.example .env.local
npm install
npx vercel dev
```

Fill `.env.local` with real secrets. `GOOGLE_SERVICE_ACCOUNT_JSON` must be the entire downloaded service-account JSON, minified onto one line.

## Deploy

1. Push this folder to a new GitHub repository.
2. In Vercel, choose **Add New → Project**, import that repository, and deploy.
3. In the Vercel project’s **Settings → Environment Variables**, add every non-comment value from `.env.example` (use the real values), then redeploy.
4. Open `https://YOUR-VERCEL-DOMAIN/api/health`; it should report `ok: true`.
5. Set the Telegram webhook once, replacing values:

```text
https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://<VERCEL_DOMAIN>/api/telegram-webhook&secret_token=<WEBHOOK_SECRET>
```

## Required test sequence

Before Test 1, clear practice rows in Supabase. In Manager Setup, link your Telegram numeric user ID to Richard, start the bot, and submit `S01` through Telegram. Re-link the same user ID to Kevin and submit `E01` through Telegram. The system retains the original submitter and chat ID. Enter the rest through the website, approve the required records, and verify the Test 1 figures. Then add Test 2. Do **not** use the seed SQL for final submission: it is only a reference fixture.

The website and Telegram webhook use the same server-side transaction processing function (`api/lib/core.mjs`). Permissions are checked on the server, not merely hidden in the UI.
