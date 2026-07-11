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
# Copy better-sqlite3 native module (not bundled in standalone)
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3

# Copy entrypoint script (fixes /data PVC ownership as root, then drops to app)
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

RUN mkdir -p /data && chown -R app:app /app /data
# NOTE: 不设置 USER app —— entrypoint 需以 root 启动以 chown /data PVC，
# 然后通过 runuser 降权到 app 用户执行 node server.js
VOLUME ["/data"]
EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
