# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ 

# Copy package files with validation
COPY package*.json ./
COPY yarn.lock ./

# Install dependencies with integrity check
RUN yarn install --frozen-lockfile --production=false

# Copy source code with ownership verification
COPY . .

# Build application with TypeScript strict mode
RUN yarn build

# Install Trivy for security scanning
RUN apk add --no-cache wget
RUN wget -qO - https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh
RUN trivy filesystem --severity HIGH,CRITICAL --no-progress /app

# Validate build artifacts
RUN test -d dist

# Production stage
FROM node:18-alpine

# Create non-root user/group
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Set secure file permissions
RUN mkdir -p /app && chown -R appuser:appgroup /app

# Set working directory
WORKDIR /app

# Copy validated build artifacts
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/package*.json ./
COPY --from=builder --chown=appuser:appgroup /app/yarn.lock ./

# Install production-only dependencies
RUN yarn install --frozen-lockfile --production=true

# Configure environment isolation
ENV NODE_ENV=production \
    PORT=8080 \
    HEALTH_CHECK_PATH=/health

# Set up health checks
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}${HEALTH_CHECK_PATH} || exit 1

# Configure resource limits
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Enable metrics collection
ENV PROMETHEUS_METRICS=true \
    METRICS_PATH=/metrics

# Set up logging
ENV LOG_LEVEL=info \
    LOG_FORMAT=json

# Switch to non-root user
USER appuser

# Expose worker port
EXPOSE ${PORT}

# Set secure entry point
CMD ["node", "dist/workers/alert.worker.js", "dist/workers/analytics.worker.js", "dist/workers/sensor.worker.js"]