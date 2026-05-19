FROM node:20-slim AS builder
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci
COPY backend/src ./src
COPY backend/tsconfig.json ./
RUN npm run build

FROM node:20-slim
WORKDIR /app

# Install Playwright system dependencies (Debian/apt-based)
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    libgbm1 \
    libxshmfence1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/templates ./src/templates
COPY backend/package*.json ./
RUN npm ci --only=production

# Let Playwright download and use its own matched Chromium
RUN npx playwright install chromium

# Serve the dashboard UI as a static file
RUN mkdir -p public
COPY backend/public/index.html ./public/index.html

RUN mkdir -p reports data logs

EXPOSE 3001
CMD ["node", "dist/index.js"]
