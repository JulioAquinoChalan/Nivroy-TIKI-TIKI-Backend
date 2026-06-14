# Nivroy TIKI-TIKI Backend

Backend Node.js + Express para autenticar usuarios, guardar reglas, conectar TikTok Live y servir el overlay.

## Requisitos

- Node.js 20 o superior
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
CORS_ORIGIN=*
FIREBASE_WEB_API_KEY=your_firebase_web_api_key
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
TIKTOK_USERNAME=demo_user
```

Para Firebase necesitas:

- `FIREBASE_WEB_API_KEY`: esta en Firebase Console > Project settings > General > Web API Key.
- `FIREBASE_SERVICE_ACCOUNT_PATH`: ruta local a un JSON de service account con permisos de Firebase Admin/Firestore.
- Como alternativa puedes usar `FIREBASE_SERVICE_ACCOUNT_JSON` con el JSON completo en una variable de entorno.
- En Render se recomienda usar `FIREBASE_SERVICE_ACCOUNT_JSON` o `FIREBASE_SERVICE_ACCOUNT_BASE64`, no una ruta local.
- `CORS_ORIGIN`: usa `*` durante pruebas. En produccion puedes poner el dominio del frontend, o varios separados por coma.

No subas el JSON de service account al repo. El backend ya ignora `firebase-service-account*.json`.

## Despliegue en Render

Este repo incluye `render.yaml` para crear un Web Service en Render.

1. Sube el backend a GitHub.
2. En Render, crea un nuevo Blueprint desde el repo o un Web Service manual apuntando a esta carpeta.
3. Usa:
   - Build command: `npm ci`
   - Start command: `npm start`
   - Health check path: `/health`
4. Configura estas variables en Render:
   - `FIREBASE_WEB_API_KEY`
   - `FIREBASE_SERVICE_ACCOUNT_JSON` con el JSON completo de service account, o `FIREBASE_SERVICE_ACCOUNT_BASE64`
   - `FIREBASE_EMAIL_VERIFICATION_CONTINUE_URL` si quieres redirigir luego de verificar correo
   - `TIKTOK_USERNAME`
   - `CORS_ORIGIN`

Render asigna `PORT` automaticamente. No hace falta configurarlo.

Para generar `FIREBASE_SERVICE_ACCOUNT_BASE64` en PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes(".\firebase-service-account.json"))
```

Luego actualiza el frontend con la URL publica de Render, por ejemplo:

```bash
flutter run --dart-define=BACKEND_URL=https://nivroy-tiki-tiki-backend.onrender.com
```

## Endpoints

- `GET /health`: estado del backend y TikTok.
- `GET /events`: ultimos 100 eventos en memoria.
- `POST /auth/register`: registra email/password y envia verificacion de correo.
- `POST /auth/login`: inicia sesion con email/password.
- `POST /auth/refresh`: refresca el ID token con refresh token.
- `POST /auth/send-email-verification`: reenvia verificacion de correo.
- `GET /auth/me`: devuelve el usuario autenticado.
- `GET /rules`: reglas del usuario autenticado en Firestore.
- `POST /rules`: crea o reemplaza una regla por trigger para el usuario autenticado.
- `DELETE /rules/:id`: elimina una regla del usuario autenticado.
- `POST /tiktok/connect`: conecta a TikTok Live.
- `POST /tiktok/disconnect`: desconecta TikTok Live.
- `GET /overlay/rules`: overlay HTML para agregar como Browser Source en TikTok Live Studio.

Las rutas de `rules` y TikTok requieren `Authorization: Bearer <idToken>` y correo verificado.

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
- `error`

Los comandos de Minecraft se ejecutan desde el frontend usando ServerTap.

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
