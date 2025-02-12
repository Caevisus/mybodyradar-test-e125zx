# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ curl

# Copy package files
COPY src/backend/package*.json ./
COPY src/backend/tsconfig.json ./

# Install dependencies
RUN npm ci --ignore-scripts

# Copy source code
COPY src/backend/src ./src

# Build application
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# Production stage
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install production dependencies
RUN apk add --no-cache curl tzdata \
    && addgroup -g 1001 -S node \
    && adduser -u 1001 -S node -G node

# Copy built artifacts from builder stage
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./package.json

# Set secure permissions
RUN chmod -R 755 /app \
    && find /app -type f -exec chmod 644 {} \; \
    && find /app/dist -type f -name "*.js" -exec chmod 755 {} \;

# Configure environment
ENV NODE_ENV=production \
    PORT=3000 \
    TZ=UTC \
    API_VERSION=v1 \
    NODE_OPTIONS="--max-old-space-size=2048 --max-http-header-size=16384" \
    NODE_ICU_DATA=/app/node_modules/full-icu

# Expose application port
EXPOSE 3000

# Switch to non-root user
USER node

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Set security options
LABEL maintainer="Smart Apparel Team" \
    version="1.0.0" \
    description="Smart Apparel Backend API Service" \
    security.updates="automatic" \
    health.interval="30s"

# Drop capabilities and set security options
SECURITY_OPT no-new-privileges:true
SECURITY_OPT seccomp=unconfined
SECURITY_OPT apparmor=unconfined

# Start application
CMD ["node", "dist/server.js"]