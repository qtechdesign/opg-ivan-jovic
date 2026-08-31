FROM node:22-bookworm-slim

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
COPY plates ./plates

ENV POLJE_DATA=/var/lib/polje
RUN mkdir -p /var/lib/polje

CMD ["node", "src/index.js"]
