# Build stage
FROM node:18-alpine AS builder
# v18.17.1-alpine3.18

# Set working directory
WORKDIR /app

# Set build arguments and environment variables
ARG BUILD_VERSION
ENV NODE_ENV=production
ENV BUILD_VERSION=${BUILD_VERSION}

# Install dependencies first (for better caching)
COPY src/web/package*.json ./
RUN npm ci --only=production

# Copy source files
COPY src/web/tsconfig*.json ./
COPY src/web/vite.config.ts ./
COPY src/web/src ./src
COPY src/web/public ./public

# Type check and build
RUN npm run type-check && \
    npm run build

# Production stage
FROM nginx:1.25-alpine
# v1.25.2-alpine3.18

# Create non-root user
RUN adduser -D -H -u 101 -s /sbin/nologin nginx

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx configuration
RUN mkdir -p /etc/nginx/templates
COPY infrastructure/docker/nginx.conf.template /etc/nginx/templates/default.conf.template

# Configure nginx with security headers and compression
RUN echo 'server_tokens off;' > /etc/nginx/conf.d/security.conf && \
    echo 'add_header X-Content-Type-Options nosniff;' >> /etc/nginx/conf.d/security.conf && \
    echo 'add_header X-Frame-Options DENY;' >> /etc/nginx/conf.d/security.conf && \
    echo 'add_header X-XSS-Protection "1; mode=block";' >> /etc/nginx/conf.d/security.conf && \
    echo 'add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";' >> /etc/nginx/conf.d/security.conf && \
    echo 'add_header Content-Security-Policy "default-src '\''self'\'';";' >> /etc/nginx/conf.d/security.conf

# Configure gzip compression
RUN echo 'gzip on;' > /etc/nginx/conf.d/gzip.conf && \
    echo 'gzip_vary on;' >> /etc/nginx/conf.d/gzip.conf && \
    echo 'gzip_min_length 10240;' >> /etc/nginx/conf.d/gzip.conf && \
    echo 'gzip_proxied expired no-cache no-store private auth;' >> /etc/nginx/conf.d/gzip.conf && \
    echo 'gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml application/javascript application/json;' >> /etc/nginx/conf.d/gzip.conf

# Create health check endpoint
RUN mkdir -p /usr/share/nginx/html/health && \
    echo "OK" > /usr/share/nginx/html/health/index.html

# Set permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# Switch to non-root user
USER nginx

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl --fail http://localhost:80/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]