# ============================================
# Combined Multi-stage Dockerfile
# Builds both API server and Web client
# ============================================

# --------------------------------------------
# Stage 1: Base - Node.js with pnpm
# --------------------------------------------
FROM node:20-alpine AS base

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# --------------------------------------------
# Stage 2: Dependencies - Install all deps
# --------------------------------------------
FROM base AS dependencies

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy package.json files for all workspaces
COPY shared/package.json ./shared/
COPY api/package.json ./api/
COPY web/package.json ./web/

# Install all dependencies (including dev dependencies needed for build)
RUN pnpm install --frozen-lockfile

# --------------------------------------------
# Stage 3: Build Shared - Build shared package
# --------------------------------------------
FROM dependencies AS build-shared

# Copy shared package source
COPY shared ./shared
COPY tsconfig.base.json ./

# Build shared package
RUN pnpm --filter @ship/shared build

# --------------------------------------------
# Stage 4: Build API - Build API server
# --------------------------------------------
FROM build-shared AS build-api

# Copy API source code
COPY api/src ./api/src
COPY api/tsconfig.json ./api/

# Build the API
RUN pnpm --filter @ship/api build

# --------------------------------------------
# Stage 5: Build Web - Build web client
# --------------------------------------------
FROM build-shared AS build-web

# Copy web client source
COPY web ./web

# Build web client (TypeScript compilation + Vite build)
RUN pnpm --filter @ship/web build

# --------------------------------------------
# Stage 6: Production Dependencies
# --------------------------------------------
FROM base AS prod-dependencies

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy package.json files
COPY shared/package.json ./shared/
COPY api/package.json ./api/

# Install production dependencies only (web doesn't need runtime deps)
RUN pnpm install --frozen-lockfile --prod

# --------------------------------------------
# Stage 7: Production - Combined server
# --------------------------------------------
FROM node:20-alpine AS production

WORKDIR /app

# Install dumb-init for proper signal handling and nginx for serving static files
RUN apk add --no-cache dumb-init nginx

# Copy production dependencies
COPY --from=prod-dependencies /app/node_modules ./node_modules
COPY --from=prod-dependencies /app/shared/node_modules ./shared/node_modules
COPY --from=prod-dependencies /app/api/node_modules ./api/node_modules

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json ./

# Copy built shared package
COPY --from=build-shared /app/shared/dist ./shared/dist
COPY --from=build-shared /app/shared/package.json ./shared/package.json

# Copy built API
COPY --from=build-api /app/api/dist ./api/dist
COPY api/package.json ./api/

# Copy any migration/seed scripts if needed
COPY api/src/db ./api/src/db

# Copy built web client static files
COPY --from=build-web /app/web/dist ./web/dist

# Create nginx configuration for serving web client and proxying API
RUN mkdir -p /etc/nginx/http.d && \
    echo 'server { \
    listen 8080; \
    server_name _; \
    root /app/web/dist; \
    index index.html; \
    \
    # Enable gzip compression \
    gzip on; \
    gzip_vary on; \
    gzip_min_length 1024; \
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json; \
    \
    # Security headers \
    add_header X-Frame-Options "SAMEORIGIN" always; \
    add_header X-Content-Type-Options "nosniff" always; \
    add_header X-XSS-Protection "1; mode=block" always; \
    \
    # Cache static assets \
    location ~* \\.(?:css|js|jpg|jpeg|gif|png|ico|svg|woff|woff2|ttf|eot)$ { \
        expires 1y; \
        add_header Cache-Control "public, immutable"; \
    } \
    \
    # API proxy to Node.js backend \
    location /api { \
        proxy_pass http://127.0.0.1:3000; \
        proxy_http_version 1.1; \
        proxy_set_header Upgrade $http_upgrade; \
        proxy_set_header Connection "upgrade"; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \
        proxy_set_header X-Forwarded-Proto $scheme; \
    } \
    \
    # SPA fallback - serve index.html for all routes \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/http.d/default.conf

# Remove default nginx config
RUN rm -f /etc/nginx/conf.d/default.conf

# Create startup script that runs both nginx and the API server
RUN echo '#!/bin/sh\n\
set -e\n\
\n\
# Start nginx in the background\n\
nginx\n\
\n\
# Start the API server in the foreground\n\
exec node api/dist/server.js\n\
' > /app/start.sh && chmod +x /app/start.sh

# Set NODE_ENV to production
ENV NODE_ENV=production
ENV PORT=3000

# Expose both nginx (8080) and API (3000) ports
# In production, you typically only expose 8080 (nginx handles everything)
EXPOSE 8080 3000

# Use non-root user for security (nginx will run as nginx user)
USER node

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start both services
CMD ["/app/start.sh"]
