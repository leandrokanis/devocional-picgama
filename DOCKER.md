# 🐳 Docker Compose - Devocional Bot

## Pré-requisitos

- Docker Desktop instalado e rodando
- Arquivo `.env` configurado (ou variáveis de ambiente)

## 🏗️ Arquitetura Simplificada

A nova arquitetura é completamente local e autônoma:
- ✅ **Sem MongoDB**: Sessão salva em arquivos locais
- ✅ **Sem GitHub Actions**: Cron interno para agendamento
- ✅ **Sem dependências externas**: Tudo roda na mesma máquina

## 🚀 Modo Desenvolvimento (Hot Reload)

### Configuração Rápida

1. **Copie o arquivo de exemplo:**
```bash
cp docker-dev.env.example .env
```

2. **Configure suas variáveis no arquivo `.env`:**
```env
# Essenciais
GROUP_CHAT_ID=seu_grupo_id_aqui@g.us
WHATSAPP_SESSION_NAME=devocional-bot
SEND_TIME=06:00
TIMEZONE=America/Sao_Paulo

# Opcionais
PORT=3000
DEBUG=false
AUTH_TOKEN=seu_token_secreto_aqui
CONFIG_USER=admin
CONFIG_PASSWORD=sua_senha_admin

# Desenvolvimento
NODE_ENV=development
DOCKERFILE=Dockerfile.dev
```

3. **Execute em modo desenvolvimento:**
```bash
# Opção 1: Script automático
./docker-dev.sh

# Opção 2: Yarn script
yarn docker:dev

# Opção 3: Comandos manuais
yarn docker:dev:build
yarn docker:dev:up
```

### Funcionalidades do Modo Dev

- ✅ **Hot Reload**: Mudanças no código são aplicadas automaticamente
- ✅ **Debug ativo**: Logs detalhados para desenvolvimento
- ✅ **Volume mapping**: Arquivos `src/` são mapeados para o container
- ✅ **Sem build**: Executa diretamente o TypeScript com Bun

### Comandos de Desenvolvimento

```bash
# Construir apenas a imagem de dev
yarn docker:dev:build

# Subir em modo desenvolvimento
yarn docker:dev:up

# Parar containers
yarn docker:dev:down

# Ver logs em tempo real
docker-compose logs -f
```

## 📦 Modo Produção

### Uso Rápido

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
