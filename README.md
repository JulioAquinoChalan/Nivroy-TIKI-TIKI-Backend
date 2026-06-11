# Nivroy TIKI-TIKI Backend

Backend Node.js + Express para conectar eventos de TikTok Live con comandos de Minecraft Paper por RCON.

## Requisitos

- Node.js 20 o superior
- Minecraft Paper con RCON habilitado
- Proyecto Firebase con Authentication por email/password y Firestore habilitados

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
FIREBASE_WEB_API_KEY=your_firebase_web_api_key
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
TIKTOK_USERNAME=demo_user
MINECRAFT_HOST=127.0.0.1
MINECRAFT_PORT=25575
MINECRAFT_RCON_PASSWORD=change_me
```

Para Firebase necesitas:

- `FIREBASE_WEB_API_KEY`: esta en Firebase Console > Project settings > General > Web API Key.
- `FIREBASE_SERVICE_ACCOUNT_PATH`: ruta local a un JSON de service account con permisos de Firebase Admin/Firestore.
- Como alternativa puedes usar `FIREBASE_SERVICE_ACCOUNT_JSON` con el JSON completo en una variable de entorno.

No subas el JSON de service account al repo. El backend ya ignora `firebase-service-account*.json`.

## Endpoints

- `GET /health`: estado del backend, TikTok y Minecraft.
- `GET /events`: ultimos 100 eventos en memoria.
- `POST /auth/register`: registra email/password y envia verificacion de correo.
- `POST /auth/login`: inicia sesion con email/password.
- `POST /auth/refresh`: refresca el ID token con refresh token.
- `POST /auth/send-email-verification`: reenvia verificacion de correo.
- `GET /auth/me`: devuelve el usuario autenticado.
- `GET /rules`: reglas del usuario autenticado en Firestore.
- `POST /rules`: crea o reemplaza una regla por trigger para el usuario autenticado.
- `DELETE /rules/:id`: elimina una regla del usuario autenticado.
- `POST /minecraft/command`: ejecuta un comando RCON.
- `POST /tiktok/connect`: conecta a TikTok Live.
- `POST /tiktok/disconnect`: desconecta TikTok Live.
- `GET /overlay/rules`: overlay HTML para agregar como Browser Source en TikTok Live Studio.

Las rutas de `rules`, Minecraft y TikTok requieren `Authorization: Bearer <idToken>` y correo verificado.

Ejemplo:

```bash
curl -X POST http://localhost:3000/minecraft/command \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ID_TOKEN" \
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
  -H "Authorization: Bearer $ID_TOKEN" \
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
