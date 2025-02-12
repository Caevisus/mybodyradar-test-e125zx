# Build Stage
FROM node:18-alpine@sha256:47d97b93629d9461d64197773966cc49081cf4463b1b07de5a38b6bd5acfbe9d as builder

# Set working directory
WORKDIR /app

# Add non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Install security updates and build dependencies
RUN apk update && \
    apk upgrade && \
    apk add --no-cache python3 make g++ git curl

# Copy package files first for better layer caching
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && \
    # Run security audit
    npm audit && \
    # Clean npm cache
    npm cache clean --force

# Copy source code and configuration
COPY . .

# Set build-time variables
ARG BUILD_VERSION
ENV VITE_BUILD_VERSION=${BUILD_VERSION}
ENV NODE_ENV=production

# Build application with optimizations
RUN npm run build && \
    # Remove source maps in production for security
    find build -name '*.map' -delete

# Scan for vulnerabilities in built artifacts
RUN npm audit && \
    # Set correct permissions
    chown -R appuser:appgroup /app

# Production Stage
FROM nginx:1.25-alpine@sha256:6a2f8b28e45c4adea04ec207a251fd4a2df03ddc930f782af51e315ebc76e9a9

# Install security updates
RUN apk update && \
    apk upgrade && \
    # Add security packages
    apk add --no-cache curl tzdata

# Create nginx user and group
RUN addgroup -S nginxgroup && \
    adduser -S nginxuser -G nginxgroup

# Copy nginx configuration with security hardening
COPY nginx.conf /etc/nginx/nginx.conf
COPY security-headers.conf /etc/nginx/security-headers.conf

# Copy built artifacts from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Set up security headers and configurations
RUN chmod -R 755 /usr/share/nginx/html && \
    chown -R nginxuser:nginxgroup /usr/share/nginx/html && \
    # Remove default nginx config
    rm /etc/nginx/conf.d/default.conf

# Configure nginx security settings
RUN sed -i 's/user  nginx/user  nginxuser/g' /etc/nginx/nginx.conf && \
    # Disable server tokens
    echo "server_tokens off;" >> /etc/nginx/nginx.conf

# Add custom nginx configuration
RUN echo "gzip on;" >> /etc/nginx/nginx.conf && \
    echo "gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;" >> /etc/nginx/nginx.conf

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Expose port
EXPOSE 80

# Switch to non-root user
USER nginxuser

# Set environment variables
ENV NODE_ENV=production \
    NGINX_PORT=80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

# Add build metadata
LABEL maintainer="Smart Apparel Team" \
      version="${BUILD_VERSION}" \
      description="Smart Apparel Web Frontend" \
      org.opencontainers.image.source="https://github.com/smart-apparel/web-frontend" \
      org.opencontainers.image.licenses="MIT"