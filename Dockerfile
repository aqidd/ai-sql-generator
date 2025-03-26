# Created: 2025-03-16
# - Initial Dockerfile setup with multi-stage build for optimized production image
# - Uses Node 20 for better performance and latest LTS features

# Build stage
FROM node:20-alpine as builder

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
RUN mkdir uploads

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Add security measures
USER node
ENV NODE_ENV=production

EXPOSE 3000
CMD ["node", "dist/server.js"]