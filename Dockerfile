# ── Stage 1: Build client ─────────────────────────────────────────────────
FROM node:20-alpine AS client-builder
WORKDIR /app
COPY client/package*.json ./client/
COPY package*.json ./
RUN npm ci --workspace=client
COPY client/ ./client/
RUN npm run build --workspace=client

# ── Stage 2: Build server ─────────────────────────────────────────────────
FROM node:20-alpine AS server-builder
WORKDIR /app
COPY server/package*.json ./server/
COPY package*.json ./
RUN npm ci --workspace=server
COPY server/ ./server/
RUN npm run build --workspace=server

# ── Stage 3: Production image ─────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

# Copy server production dependencies
COPY server/package*.json ./server/
COPY package*.json ./
RUN npm ci --workspace=server --omit=dev

# Copy built artifacts
COPY --from=server-builder /app/server/dist ./server/dist
COPY --from=client-builder /app/client/dist ./client/dist

# Serve static client files from Express (or adjust to use nginx)
EXPOSE 8080
CMD ["node", "server/dist/index.js"]
