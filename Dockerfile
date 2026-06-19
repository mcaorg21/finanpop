FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Build frontend
COPY . .
RUN npm run build

# Build server
RUN npx tsc -p tsconfig.server.json

# Production stage
FROM node:20-alpine AS production
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY --from=base /app/dist ./dist
COPY --from=base /app/migrations ./migrations

RUN mkdir -p /app/uploads

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/server/index.js"]
