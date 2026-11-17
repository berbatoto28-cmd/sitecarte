# AnimeConnection V20 / Railway : deploiement autonome.
# Le catalogue et les illustrations sont conserves dans une archive decoupee
# en morceaux binaires afin d'eviter les limitations des uploads GitHub.
# Le volume Railway /data (SQLite des joueurs) N'EST JAMAIS modifie ici.
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update \
    && apt-get install -y --no-install-recommends unzip \
    && rm -rf /var/lib/apt/lists/*
COPY .v20-parts/ /tmp/v20-parts/
RUN cat /tmp/v20-parts/part-*.bin > /tmp/animeconnection-v20.zip \
    && unzip -qq /tmp/animeconnection-v20.zip -d /tmp/v20 \
    && cp -a /tmp/v20/AnimeConnection_V20_Railway_A_Mettre_En_Ligne/. /app/ \
    && rm -rf /tmp/v20 /tmp/v20-parts /tmp/animeconnection-v20.zip \
    && test -f /app/server.js \
    && test -f /app/lib/game.js \
    && test -f /app/data/cards.json \
    && test -f /app/public/index.html \
    && test -f /app/public/art/summer/SUM-043.webp
COPY server.js package.json /app/
COPY lib/ /app/lib/
COPY public/ /app/public/
# Corrected static catalogue only: never copy or replace a player database.
COPY data/cards.json /app/data/cards.json
RUN node lib/test-special-edition-pools.cjs
EXPOSE 3000
CMD ["node", "--disable-warning=ExperimentalWarning", "server.js"]
