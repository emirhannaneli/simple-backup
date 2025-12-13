# Multi-stage build for Next.js application
FROM node:lts-alpine AS base

# 1. DEPS STAGE
FROM base AS deps
RUN apk add --no-cache libc6-compat curl unzip bash openssl
WORKDIR /app

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash && \
    cp /root/.bun/bin/bun /usr/local/bin/bun

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile || bun install

# 2. BUILDER STAGE
FROM base AS builder
RUN apk add --no-cache curl unzip bash openssl
WORKDIR /app

# Install Bun for builder
RUN curl -fsSL https://bun.sh/install | bash && \
    cp /root/.bun/bin/bun /usr/local/bin/bun

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV DATABASE_URL=file:./prisma/system.db
ENV BACKUP_BASE_PATH=/data/backups
ENV NEXT_PUBLIC_APP_URL=http://localhost:80

# Generate Prisma Client
RUN bun run prisma:generate

# Build the application
RUN bun run build

# 3. RUNNER STAGE
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Default DATABASE_URL (can be overridden at runtime)
ENV DATABASE_URL=file:/data/system.db

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
# Copy Prisma Client and engines (full @prisma/client package needed for Bun)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
# Copy @prisma/client package for seed script
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
# Copy argon2 for seed script
COPY --from=builder /app/node_modules/argon2 ./node_modules/argon2

COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

RUN apk add --no-cache wget curl unzip bash openssl ca-certificates && \
    echo "http://dl-cdn.alpinelinux.org/alpine/v3.15/main" >> /etc/apk/repositories && \
    apk update && \
    apk add --no-cache libssl1.1 && \
    curl -fsSL https://bun.sh/install | bash && \
    cp /root/.bun/bin/bun /usr/local/bin/bun && \
    ln -s /usr/local/bin/bun /usr/local/bin/bunx

# Install database client tools (pre-install for convenience)
# These are the most common database clients available in Alpine repos
# Note: Some tools (InfluxDB, Neo4j, MongoDB, Cassandra) may require manual installation
RUN apk add --no-cache \
    mysql-client \
    postgresql-client \
    sqlite \
    redis \
    openjdk17-jre

# Dizinleri oluştur
RUN mkdir -p /data /data/backups && \
    chown -R nextjs:nodejs /app /data

USER nextjs

EXPOSE 80

ENV PORT=80
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]