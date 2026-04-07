# Render / Free Deploy Notes

This repository is now prepared for Render Blueprint deploy via [`render.yaml`](../render.yaml).

## What the blueprint creates

- `freelancekg-web`: static frontend
- `freelancekg-api`: Node web service
- `freelancekg-db`: Render PostgreSQL database

## Default production-safe switches

The blueprint intentionally starts in a conservative mode:

- `ENABLE_OAUTH=false`
- `DEV_OAUTH_MOCK=false`
- `PAYMENT_PROVIDER=disabled`
- `TELEGRAM_POLLING_ENABLED=false`
- `STORAGE_PROVIDER=local`

This allows the project to boot on Render without requiring OAuth, payment gateway, Telegram bot, Redis, or SMTP during the first deploy.

## Important free-tier limitations

- Local uploads are **not durable** on free instances. With `STORAGE_PROVIDER=local`, uploaded avatars/files can disappear after redeploy or instance replacement.
- To make uploads durable, switch to `STORAGE_PROVIDER=s3` and provide:
  - `S3_PUBLIC_BASE_URL`
  - `S3_BUCKET`
  - `S3_REGION`
  - `S3_ACCESS_KEY_ID`
  - `S3_SECRET_ACCESS_KEY`
- SMTP is optional at startup now. If not configured, emails are logged instead of sent.
- OAuth is disabled by default in the blueprint. Enable it only after setting provider credentials and callback URLs.

## Recommended post-deploy upgrades

1. Configure S3-compatible object storage for uploads.
2. Configure a transactional email provider.
3. If needed, enable OAuth with real callback URLs:
   - `GOOGLE_CALLBACK_URL`
   - `GITHUB_CALLBACK_URL`
4. If needed, configure Telegram and re-enable polling.
5. If you move to a paid plan, you can add persistent disk or external storage/cache services.
