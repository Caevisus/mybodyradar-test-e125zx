# Builder stage
FROM node:18-alpine@sha256:f4c96a28c0b2d8981664e03f461c2677152cd9a756012ffa8e2c6727427c2bda AS builder

# Set working directory with appropriate permissions
WORKDIR /app
RUN chmod 755 /app

# Copy package files with layer caching optimization
COPY package.json yarn.lock ./

# Install dependencies with yarn for deterministic builds
RUN yarn install --frozen-lockfile --production=false \
    && yarn cache clean

# Copy source code and config files
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript application
RUN yarn build \
    && yarn install --frozen-lockfile --production=true \
    && yarn cache clean

# Production stage
FROM node:18-alpine@sha256:f4c96a28c0b2d8981664e03f461c2677152cd9a756012ffa8e2c6727427c2bda

# Set production environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    TZ=UTC \
    NODE_OPTIONS="--max-old-space-size=2048 --max-http-header-size=16384" \
    UV_THREADPOOL_SIZE=4

# Create non-root user and group
RUN addgroup -g 1001 -S node \
    && adduser -u 1001 -S node -G node

# Set working directory
WORKDIR /app
RUN chown -R node:node /app

# Copy built artifacts from builder stage
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./

# Set secure file permissions
RUN chmod 644 package.json \
    && chmod -R 755 dist \
    && chmod -R 755 node_modules

# Security hardening
RUN apk add --no-cache curl \
    && rm -rf /var/cache/apk/* \
    && rm -rf /tmp/*

# Expose application port
EXPOSE 3000

# Switch to non-root user
USER node

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Set security options
LABEL maintainer="Smart Apparel Team <team@smartapparel.com>" \
    version="1.0.0" \
    description="Smart Apparel Backend Service" \
    security.scan-date="{{BUILD_DATE}}" \
    com.smartapparel.image.title="backend-service"

# Start application with production optimizations
CMD ["node", "--enable-source-maps", "dist/server.js"]