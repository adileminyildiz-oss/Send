# Image de production : Node + ffmpeg (indispensable pour le rendu vidéo).
# Utilisable sur Render, Railway, Fly.io, ou tout hébergeur Docker.
FROM node:20-slim

# ffmpeg avec libx264 + libass (textes) est inclus dans le paquet Debian.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dépendances (cache Docker : on copie d'abord les manifestes).
COPY package*.json ./
RUN npm ci --omit=dev

# Code applicatif.
COPY . .

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

EXPOSE 3000
CMD ["node", "server/server.js"]
