# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src ./src
RUN npm run build

# Stage 2: Runtime
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY public ./public

# Create directories for persistent data
RUN mkdir -p /app/uploads/releases /app/uploads/files /app/data

EXPOSE 3000

VOLUME ["/app/uploads", "/app/data"]

CMD ["node", "dist/server.js"]
