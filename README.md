# PhoneShop HRM

Staff attendance, leave and payroll for multi-branch phone shops (Asia/Colombo time).

- **Attendance**: clock in/out only from the shop's network (allowed IPs / IPv6 ranges per shop), lunch in/out with a timed break, random active-work checks.
- **Leave**: leave types, yearly balances (created automatically), request and approval flow.
- **Payroll**: monthly paysheets from attendance, late/half-day/OT rules and penalty points; finalize → paid → acknowledged/disputed.

Next.js 16 (App Router, `src/proxy.ts`), Prisma 7 + PostgreSQL, Auth.js v5, deployed on Vercel.

## Local setup

```bash
npm install
cp .env.example .env        # point DATABASE_URL at your own database
npm run db:deploy           # apply migrations
SEED_CONFIRM=wipe-all-data SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD='...' npm run db:seed   # optional demo data
npm run dev
```

IP checks are skipped in development.

## Database changes

Schema changes go through migrations, never `db push`, on any shared database:

```bash
npm run db:migrate -- --name describe_change   # create + apply locally
npm run db:deploy                              # apply to another database (before deploying the code)
```

## Scheduled jobs

| Job | Trigger | Does |
| --- | --- | --- |
| `/api/cron/daily` | Vercel cron, 00:00 Colombo | closes open shifts, finalizes attendance, penalizes overdue lunches/checks, creates leave balances, cleanup |
| `/api/cron/verifications` | GitHub Actions (`.github/workflows/verification-pings.yml`), every 10 min in shop hours | random work checks, overdue lunch sweep |
| Database backup | GitHub Actions (`.github/workflows/backup.yml`), daily | encrypted `pg_dump` artifact |

GitHub secrets needed: `APP_URL`, `CRON_SECRET`, `DATABASE_URL`, `BACKUP_PASSPHRASE`.
