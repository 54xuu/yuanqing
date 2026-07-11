# ---------- deps: install dependencies including native modules ----------
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

# ---------- builder: build Next.js app ----------
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------- runner: minimal production image ----------
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV YUANQING_DB_PATH=/data/yuanqing.db

RUN groupadd -r app && useradd -r -g app app

# Copy standalone build output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# Copy public assets if they exist
# Copy better-sqlite3 native module (not bundled in standalone)
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3

RUN mkdir -p /data && chown -R app:app /app /data
USER app
VOLUME ["/data"]
EXPOSE 3000

CMD ["node", "server.js"]
