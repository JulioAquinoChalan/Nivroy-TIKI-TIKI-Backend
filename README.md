# Nivroy TIKI-TIKI Backend

Backend Node.js + Express para conectar eventos de TikTok Live con comandos de Minecraft Paper por RCON.

## Requisitos

- Node.js 20 o superior
- Minecraft Paper con RCON habilitado

## Instalacion

```bash
npm install
cp .env.example .env
npm run dev
```

## Variables

Configura `.env` sin usar credenciales reales en archivos versionados:

```bash
PORT=3000
TIKTOK_USERNAME=demo_user
MINECRAFT_HOST=127.0.0.1
MINECRAFT_PORT=25575
MINECRAFT_RCON_PASSWORD=change_me
```

## Endpoints

- `GET /health`: estado del backend, TikTok y Minecraft.
- `GET /events`: ultimos 100 eventos en memoria.
- `GET /rules`: reglas de regalos a comandos.
- `POST /rules`: crea o reemplaza una regla por trigger.
- `DELETE /rules/:id`: elimina una regla.
- `POST /minecraft/command`: ejecuta un comando RCON.
- `POST /tiktok/connect`: conecta a TikTok Live.
- `POST /tiktok/disconnect`: desconecta TikTok Live.
- `GET /overlay/rules`: overlay HTML para agregar como Browser Source en TikTok Live Studio.

Ejemplo:

```bash
curl -X POST http://localhost:3000/minecraft/command \
  -H "Content-Type: application/json" \
  -d '{"command":"say Hola {user}","username":"demo_user","minecraftHost":"127.0.0.1","minecraftPort":25575}'
```

Si `minecraftHost` o `minecraftPort` no vienen en el request, el backend usa `MINECRAFT_HOST` y `MINECRAFT_PORT` desde `.env`.

## WebSocket

El WebSocket corre en el mismo host y puerto del backend. Emite eventos JSON:

- `connected`
- `disconnected`
- `chat`
- `like`
- `gift`
- `follow`
- `member`
- `share`
- `minecraft_command_executed`
- `error`

## Reglas iniciales

- `Rose` -> `summon creeper`
- `Heart Me` -> `summon zombie`
- `GG` -> `summon skeleton`

Ejemplo para crear una regla:

```bash
curl -X POST http://localhost:3000/rules \
  -H "Content-Type: application/json" \
  -d '{"trigger":"Rose","target":"Creeper","command":"summon creeper"}'
```

## Overlay para TikTok Live Studio

TikTok Live Studio puede rechazar URLs locales como `localhost` o `127.0.0.1`. Si eso pasa, crea una URL HTTPS temporal con Cloudflare Tunnel:

```bash
npm run tunnel
```

El comando muestra una URL parecida a:

```text
https://example.trycloudflare.com
```

Usa esa URL con la ruta del overlay:

```text
https://example.trycloudflare.com/overlay/rules
```

Para navegador local tambien puedes usar:

```text
http://localhost:3000/overlay/rules
```

El overlay muestra las reglas activas y se actualiza cada 3 segundos. El comando `npm run tunnel` debe quedar abierto mientras uses la fuente en Live Studio.
