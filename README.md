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

Monitor (ultimo snapshot):

```
https://IP_DEL_HOST:8443/monitor.html
```

## Como funciona
- La pagina web usa `navigator.mediaDevices.getUserMedia()` para pedir permiso de camara.
- El video se muestra en un `<video>` en tiempo real.
- El navegador envia frames por WebSocket para streaming en vivo.
- Si activas snapshots, el navegador captura un frame con `<canvas>` y lo envia al backend.
- El backend guarda el ultimo snapshot en `/snapshots/latest.jpg` para el monitor.

## Streaming en vivo
- El monitor usa WebSocket para mostrar video en vivo.
- Si el streaming no esta disponible, cae a snapshots cada 5s.

## Nota sobre HTTPS
La API de camara requiere HTTPS (o localhost). En la LAN necesitas un certificado TLS. Puedes:
- Usar un certificado autofirmado y aceptarlo en el telefono.
- Usar `mkcert` para crear certificados locales confiables.
