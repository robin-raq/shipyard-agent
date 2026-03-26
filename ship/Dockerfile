# ============================================
# Combined Multi-stage Dockerfile
# Builds both API server and Web client
# ============================================

# Cache busting argument
ARG CACHE_BUST=1

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

# Copy workspace configuration and lock file separately
# This ensures package changes bust the cache
COPY pnpm-workspace.yaml package.json ./
COPY pnpm-lock.yaml ./

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

# Bust cache to ensure fresh source code
ARG CACHE_BUST=1
RUN echo "Cache bust: $CACHE_BUST"

# Copy shared package source
COPY shared ./shared
COPY tsconfig.base.json ./

# Build shared package
RUN pnpm --filter @ship/shared build

# --------------------------------------------
# Stage 4: Build API - Build API server
# --------------------------------------------
FROM build-shared AS build-api

# Bust cache to ensure fresh source code
ARG CACHE_BUST=1
RUN echo "Cache bust: $CACHE_BUST"

# Copy API source code
COPY api/src ./api/src
COPY api/tsconfig.json ./api/

# Build the API
RUN pnpm --filter @ship/api build

# --------------------------------------------
# Stage 5: Build Web - Build web client
# --------------------------------------------
FROM build-shared AS build-web

# Bust cache to ensure fresh source code
ARG CACHE_BUST=1
RUN echo "Cache bust: $CACHE_BUST"

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
# Stage 7: Production - Express serves API + static files
# --------------------------------------------
FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache dumb-init

# Copy production dependencies
COPY --from=prod-dependencies /app/node_modules ./node_modules
COPY --from=prod-dependencies /app/api/node_modules ./api/node_modules

# Copy workspace config
COPY pnpm-workspace.yaml package.json ./

# Copy built shared package
COPY --from=build-shared /app/shared/dist ./shared/dist
COPY --from=build-shared /app/shared/package.json ./shared/package.json

# Copy built API
COPY --from=build-api /app/api/dist ./api/dist
COPY api/package.json ./api/

# Copy migration SQL files (needed at runtime)
COPY api/src/db/migrations ./api/dist/db/migrations

# Copy built web client static files
COPY --from=build-web /app/web/dist ./public

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

USER node

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "api/dist/server.js"]
