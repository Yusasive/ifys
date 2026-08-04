# Build context is the repo root (npm workspaces monorepo — backend's
# package-lock.json is shared with frontend at the root):
#   docker build -f backend/Dockerfile -t ify-backend .

FROM node:22-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /app

# ── Install deps (dev included — needed to run `nest build`) ────────────────
FROM base AS deps
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
# --ignore-scripts: schema.prisma isn't copied in yet, so the backend's
# `postinstall: prisma generate` would fail here — run it explicitly in the
# builder stage below once the full source is present.
RUN npm ci --workspace backend --include-workspace-root --ignore-scripts

# ── Build ─────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY backend ./backend
RUN sh -c "cd backend && npx prisma generate"
RUN npm run build --workspace backend

# ── Production image ────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
# --ignore-scripts: skips `postinstall: prisma generate` here — the schema
# isn't copied in yet, and it's unneeded anyway since nest build already
# compiled the generated Prisma client (src/generated/prisma) into dist/.
RUN npm ci --workspace backend --include-workspace-root --omit=dev --ignore-scripts

# `prisma migrate deploy` at container startup needs the Prisma CLI, which
# is a devDependency (stripped above) — install it globally instead of
# carrying the whole dev toolchain into the runtime image.
RUN npm install -g prisma@7

COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/prisma ./backend/prisma
COPY --from=builder /app/backend/prisma.config.ts ./backend/prisma.config.ts
# prisma/seed.ts imports from ../src/generated/prisma directly (it runs as
# TS via tsx, not through the compiled dist/ output) — copy the generated
# client source too, not just the compiled app.
COPY --from=builder /app/backend/src/generated ./backend/src/generated

WORKDIR /app/backend

EXPOSE 3000

CMD ["sh", "-c", "prisma migrate deploy && node dist/main.js"]
