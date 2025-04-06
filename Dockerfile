# Basimage med Node.js 20
FROM node:20-slim

# Installera nödvändiga systempaket för canvas och andra beroenden
RUN apt-get update && apt-get install -y \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    build-essential \
    python3 \
    python3-pip \
    # Extra paket som kan behövas för Crawlee/Playwright
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgbm1 \
    libgdk-pixbuf2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libxss1 \
    libxtst6 \
    wget \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Sätt arbetsmappen
WORKDIR /app

# Kopiera package.json och package-lock.json (om det finns)
COPY package*.json ./
COPY .env.local .env.local

# Installera paket
RUN npm ci

# Kopiera resten av appkoden
COPY . .

# Bygg Next.js-appen
RUN npm run build

# Exponera port 3000
EXPOSE 3000

# Starta appen
CMD ["npm", "start"]