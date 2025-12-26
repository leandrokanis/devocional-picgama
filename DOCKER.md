# 🐳 Docker Compose - Devocional Bot

## Pré-requisitos

- Docker Desktop instalado e rodando
- Arquivo `.env` configurado (ou variáveis de ambiente)

## Uso Rápido

### 1. Subir o serviço

```bash
docker-compose up -d
```

### 2. Ver logs

```bash
docker-compose logs -f
```

### 3. Parar o serviço

```bash
docker-compose down
```

### 4. Reconstruir após mudanças

```bash
docker-compose up -d --build
```

## Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com:

```env
GROUP_CHAT_ID=seu-group-chat-id
WHATSAPP_SESSION_NAME=devocional-bot
SEND_TIME=07:00
TIMEZONE=America/Sao_Paulo
PORT=3000
DEBUG=false
```

## Comandos Úteis

### Ver status do container
```bash
docker-compose ps
```

### Entrar no container
```bash
docker-compose exec devocional-bot sh
```

### Verificar healthcheck
```bash
docker-compose ps
# Verifique a coluna "State" - deve mostrar "healthy"
```

### Limpar tudo (incluindo volumes)
```bash
docker-compose down -v
```

## Estrutura

- **Porta**: 3000 (configurável via `PORT`)
- **Healthcheck**: `/health` endpoint
- **Volumes**:
  - `./tokens` - Sessão WhatsApp (persistente)
  - `./data` - Leituras devocionais (read-only)

## Troubleshooting

### Container não inicia
```bash
docker-compose logs devocional-bot
```

### Reconstruir do zero
```bash
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

### Verificar se Chromium está instalado
```bash
docker-compose exec devocional-bot which chromium-browser
# Deve retornar: /usr/bin/chromium-browser
```
