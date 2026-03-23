# Camara de seguridad (web)

## Requisitos
- Docker y Docker Compose
- Un certificado TLS local

## Generar certificado local
En Linux/macOS:

```bash
mkdir -p certs
openssl req -x509 -newkey rsa:2048 -keyout certs/local.key -out certs/local.crt -days 365 -nodes -subj "/CN=localhost"
```

Si vas a acceder desde otro dispositivo en la LAN, usa el IP local del host y crea un certificado con ese IP como SAN.

## Levantar el contenedor

```bash
docker compose up -d --build
```

Accede desde el telefono con:

```
https://IP_DEL_HOST:8443
```

Monitor (video en vivo):

```
https://IP_DEL_HOST:8443/monitor.html
```

Snapshot (imagen JPEG instantanea):

```
http://IP_DEL_HOST:8080/api/snapshot
```

Tambien disponible en:

```
http://IP_DEL_HOST:80/api/snapshot
```

Variables de entorno para snapshot:

- `SNAPSHOT_SOURCE`: origen de video para FFmpeg. Ejemplos: `rtsp://usuario:pass@ip/stream` o `/dev/video0`.
- `SNAPSHOT_TIMEOUT_MS`: timeout maximo en ms (por defecto `5000`).

Comportamiento del endpoint `/api/snapshot`:

- Primero intenta devolver el ultimo frame JPEG subido por el cliente emisor activo (en memoria, sin disco).
- Si no hay frame reciente, usa fallback con FFmpeg.
- Si no hay senal disponible en ninguno de los dos, responde `503` con `{"error":"Camera not available"}`.

## Controles del monitor
- Boton de pantalla completa (doble click en el video tambien alterna fullscreen).
- Zoom visual con slider, botones +/− y rueda del mouse.
- Pan con drag cuando el zoom es mayor a 100%.
- Reset de zoom para volver al centro.
- Toggle de metricas (HUD) para ocultar/mostrar la telemetria.
- Logs en vivo con panel inferior, filtros y auto-scroll.

## Como funciona
- La pagina web usa `navigator.mediaDevices.getUserMedia()` para pedir permiso de camara.
- El video se envia por WebRTC (RTCPeerConnection) con prioridad a baja latencia y alto FPS.
- El WebSocket se usa solo para signaling (SDP + ICE).
- El monitor recibe el stream en un `<video>` con `autoplay`, `playsinline` y `muted`.
- El monitor recolecta metricas con `RTCPeerConnection.getStats()`.

## Streaming en vivo
- El monitor muestra video en tiempo real via WebRTC.
- En red local se usan candidatos ICE host (sin TURN).

## Tecnologias usadas
- Node.js + Express para el servidor HTTPS.
- WebRTC nativo (RTCPeerConnection) para video en tiempo real.
- WebSocket para signaling (SDP + ICE).
- HTML/CSS/JavaScript en el frontend.
- Docker para el despliegue local.

## Nota sobre HTTPS
La API de camara requiere HTTPS (o localhost). En la LAN necesitas un certificado TLS. Puedes:
- Usar un certificado autofirmado y aceptarlo en el telefono.
- Usar `mkcert` para crear certificados locales confiables.
