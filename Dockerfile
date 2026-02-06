FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY . ./

ENV PORT=8443 \
    CERT_PATH=/app/certs/local.crt \
    KEY_PATH=/app/certs/local.key

EXPOSE 8443

CMD ["node", "server.js"]
