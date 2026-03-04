# ============================================================
# Stage 1: Base (shared between development and production)
# ============================================================
FROM node:22-bookworm-slim AS base

WORKDIR /app

# Copy dependency manifests first for cache efficiency (addresses edge case 5.11)
COPY package.json package-lock.json* ./

# ============================================================
# Stage 2: Development (hot reload with tsx watch)
# ============================================================
FROM base AS development

RUN npm install

COPY . .

# Use non-root user for security
USER node

EXPOSE 3001

CMD ["npx", "tsx", "watch", "src/index.ts"]

# ============================================================
# Stage 3: Builder (compile TypeScript for production)
# ============================================================
FROM base AS builder

RUN npm ci --ignore-scripts

COPY . .

RUN npx tsc

# ============================================================
# Stage 4: Production (slim runtime)
# ============================================================
FROM node:22-bookworm-slim AS production

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm ci --omit=dev --ignore-scripts

COPY --from=builder /app/dist ./dist

# Use non-root user (UID 1000, matches most Linux users - addresses edge case 5.5)
USER node

EXPOSE 3001

CMD ["node", "dist/index.js"]
