# Multi-stage build for Next.js application
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./
RUN corepack enable && corepack prepare bun@latest --activate

# Install dependencies
# Note: bun.lock might not exist, so we use || true
RUN bun install --frozen-lockfile || bun install

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set build-time environment variables (can be overridden)
ARG DATABASE_URL
ARG JWT_SECRET
ARG ENCRYPTION_KEY
ARG BACKUP_BASE_PATH

ENV DATABASE_URL=${DATABASE_URL:-file:./prisma/system.db}
ENV JWT_SECRET=${JWT_SECRET:-default-jwt-secret-change-in-production}
ENV ENCRYPTION_KEY=${ENCRYPTION_KEY:-default-encryption-key-change-in-production-32-chars}
ENV BACKUP_BASE_PATH=${BACKUP_BASE_PATH:-./backups}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL:-http://localhost:3000}

# Generate Prisma Client
RUN bun run prisma:generate

# Build the application
RUN bun run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy entrypoint script
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Install bun and wget for runtime (needed for Prisma and healthcheck)
RUN apk add --no-cache wget && \
    corepack enable && corepack prepare bun@latest --activate

# Create directories for database and backups
RUN mkdir -p /data /app/backups && \
    chown -R nextjs:nodejs /app /data

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Use entrypoint script
ENTRYPOINT ["/app/docker-entrypoint.sh"]

# Start the application
CMD ["node", "server.js"]

