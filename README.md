# Devocional WhatsApp Bot (API-only)

API para envio automatizado de devocionais via WhatsApp, sem interface gráfica.

## Stack

- Node.js
- TypeScript
- Yarn
- Baileys
- SQLite (`better-sqlite3`)

## Requisitos

- Node.js 22+
- Yarn 1.22+

## Instalação

```bash
yarn install
```

## Configuração

Crie `.env` a partir de `.env.example`:

```bash
cp .env.example .env
```

Variáveis principais:

- `SEND_TIME` horário diário (`HH:MM`)
- `TIMEZONE` fuso horário
- `PORT` porta da API
- `AUTH_TOKEN` token Bearer para endpoints protegidos
- `WHATSAPP_SESSION_NAME` nome da sessão

## Execução

Desenvolvimento:

```bash
yarn dev
```

Produção local:

```bash
yarn build
yarn start
```

Envio manual:

```bash
yarn send
```

## Docker

```bash
docker compose up -d --build
docker compose logs -f
docker compose down
```

## Endpoints

### Públicos

- `GET /`
- `GET /health`
- `GET /readings`
- `GET /readings/today`
- `GET /api-docs`
- `GET /scheduler/status`

### Protegidos por Bearer token (`AUTH_TOKEN`)

- `POST /send`
- `GET /qr` (`?reconnect=true` opcional)
- `POST /scheduler/start`
- `POST /scheduler/stop`
- `GET /api/recipients`
- `POST /api/recipients`
- `GET /api/recipients/:id`
- `PUT /api/recipients/:id`
- `DELETE /api/recipients/:id`

## Exemplo de autenticação

```bash
curl -X POST http://localhost:4000/send \
  -H "Authorization: Bearer seu_token_aqui"
```

## OpenAPI

- Spec JSON: `GET /api-docs`
- Arquivo base: `src/swagger.json`

## Licença

MIT
