# Created: 2025-03-16
# - Initial Dockerfile setup with multi-stage build for optimized production image
# - Uses Node 20 for better performance and latest LTS features
# Updated: 2025-03-17
# - Added environment variables handling
# - Fixed casing in FROM AS statement
# - Added public folder copy

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Copy env file if it exists, otherwise use example
COPY --chown=node:node .env .env
COPY --chown=node:node .env.example .env.example
RUN if [ ! -f .env ]; then cp .env.example .env; fi

# Add security measures
USER node
ENV NODE_ENV=production

EXPOSE 3000
CMD ["node", "dist/server.js"]
