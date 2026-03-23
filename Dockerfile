FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache ffmpeg

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY . ./

ENV PORT=8443 \
    HTTP_PORT=8080 \
    CERT_PATH=/app/certs/local.crt \
    KEY_PATH=/app/certs/local.key \
    SNAPSHOT_SOURCE=/dev/video0 \
    SNAPSHOT_TIMEOUT_MS=5000

EXPOSE 8443
EXPOSE 8080

CMD ["node", "server.js"]
