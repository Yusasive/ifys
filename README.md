# IFY Summit — Registration, Ticketing & Check-In System

## Stack

- `backend/` — NestJS + TypeScript, modules: `auth`, `registrations`, `payments`, `tickets`, `check-ins`. Prisma ORM against PostgreSQL, Redis for cache/queue, S3-compatible object storage for uploads.
- `frontend/` — Next.js + TypeScript (App Router).

## Local setup

```bash
npm install
docker compose up -d          # Postgres (5433), Redis (6380), MinIO (9000/9001)
cd backend
npx prisma migrate dev        # applies schema in prisma/schema.prisma
cd ..
npm run dev:backend           # http://localhost:3000
npm run dev:frontend          # http://localhost:3001
```

Backend env vars: `backend/.env.example` documents the local docker-compose defaults (not real secrets — safe to copy as `backend/.env`).

## Scripts (root)

- `npm run typecheck` / `npm run lint` / `npm run test` — run across both workspaces.
- `npm run dev:backend` / `npm run dev:frontend` — run each app individually.

## Open decisions

See "Open items to raise with the user" at the bottom of [`milestone.md`](./milestone.md) — Premium tier perks, refund policy, short-code character set, and data retention period are still unresolved business decisions, not technical ones.




Organizer (full dashboard access): organizer@ifysummit.ng / dev-organizer-pw
Door staff (check-in only, redirects to /checkin): doorstaff@ifysummit.ng / dev-doorstaff-pw
superadmin@ifysummit.ng / dev-superadmin-pw