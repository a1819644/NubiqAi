# Multi-stage build for NubiqAI backend
FROM node:20-slim AS builder

# Install OS packages needed for npm (optional but common)
RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy TypeScript sources and build
COPY tsconfig.json ./
COPY . ./
RUN npm run build

# ---- Runtime ----
FROM node:20-slim
ENV NODE_ENV=production
WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled output
COPY --from=builder /app/dist ./dist

# Copy non-TS runtime assets if needed
COPY ecosystem.config.js ./ecosystem.config.js
COPY cors.json ./cors.json
COPY style.css ./style.css

# Expose the port Cloud Run will listen on
ENV PORT=8000
EXPOSE 8000

# Start the server
CMD ["node", "dist/index.js"]
