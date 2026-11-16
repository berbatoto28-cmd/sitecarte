# AnimeConnection V18 - un seul service Railway : interface + API + SQLite volume.
# Node 22.13+ est necessaire pour node:sqlite natif.
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production

# Aucun npm install : le projet utilise uniquement les modules natifs de Node.
COPY package.json ./package.json
COPY server.js ./server.js
COPY lib/ ./lib/
COPY data/cards.json ./data/cards.json
COPY public/ ./public/

# La base des joueurs se trouve sur un VOLUME RAILWAY /data (non dans /app/data).
EXPOSE 3000
CMD ["node", "--disable-warning=ExperimentalWarning", "server.js"]
