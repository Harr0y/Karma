# Karma Dockerfile
# Multi-stage build for production deployment

# Build arguments for proxy (optional)
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY

# Stage 1: Build
FROM node:20-alpine AS builder

# Re-declare ARG after FROM
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY

# Set proxy environment variables
ENV HTTP_PROXY=${HTTP_PROXY}
ENV HTTPS_PROXY=${HTTPS_PROXY}
ENV NO_PROXY=${NO_PROXY}

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++ git

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build TypeScript
RUN pnpm build

# Stage 2: Production
FROM node:20-alpine AS production

# Install runtime dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/config ./config
COPY --from=builder /app/skills ./skills

# Create non-root user for security
RUN addgroup -g 1001 -S karma && \
    adduser -S -D -H -u 1001 -h /home/karma -s /sbin/nologin -G karma -g karma karma && \
    mkdir -p /home/karma/.karma/logs /home/karma/.karma/skills && \
    chown -R karma:karma /home/karma

# Create data directory for SQLite and set permissions
RUN mkdir -p /data && \
    chown -R karma:karma /app /data

# Set environment variables
ENV NODE_ENV=production
ENV HOME=/home/karma

# Expose port
EXPOSE 3080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3080/health || exit 1

# Copy entrypoint script
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh && chown karma:karma /app/docker-entrypoint.sh

# Switch to non-root user
USER karma

# Run the server
CMD ["./docker-entrypoint.sh"]
