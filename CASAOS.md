# Deploy no CasaOS

Este projeto está pronto para rodar no CasaOS.

## Deploy manual (recomendado)

1. No servidor CasaOS, clone o repositório em `/DATA/AppData`:
   ```bash
   cd /DATA/AppData
   git clone <url-do-repositorio> devocional-picgama
   cd devocional-picgama
   ```

2. Crie o diretório de dados e configure as variáveis (via CasaOS UI ou export no shell):
   ```bash
   mkdir -p data
   # Opcional: export AUTH_TOKEN=seu_token antes de subir
   ```

3. Suba os containers:
   ```bash
   docker compose up -d --build
   ```

4. Acesse o painel em `http://<ip-do-servidor>:3002` (ou a porta em `WEBUI_PORT`)

## Importar via CasaOS

1. Clone o repositório em `/DATA/AppData/devocional-picgama/` (passo 1 acima)
2. No CasaOS: **Apps** → **+** → **Import** → **Import Docker Compose**
3. Cole o conteúdo de `docker-compose.yml`
4. Configure as variáveis de ambiente na UI do CasaOS (AUTH_TOKEN, SEND_TIME, TZ, etc.)

## Variáveis de ambiente

As variáveis vêm do ambiente (CasaOS UI, shell, etc.). O `.env.example` lista todas para referência.

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `AUTH_TOKEN` | Token para autenticação no painel | (obrigatório) |
| `SEND_TIME` | Horário de envio (HH:mm) | 06:00 |
| `TZ` | Timezone | America/Sao_Paulo |
| `WHATSAPP_SESSION_NAME` | Nome da sessão WhatsApp | devocional-bot |
| `WEBUI_PORT` | Porta da interface web | 3002 |
| `DEBUG` | Modo debug | false |

## Dados persistentes

Os dados (banco SQLite, sessão WhatsApp) ficam em `./data/` (relativo ao diretório do projeto). Ao clonar em `/DATA/AppData/devocional-picgama/`, o caminho absoluto é:

```
/DATA/AppData/devocional-picgama/data/
```

## Submissão ao CasaOS App Store

Para publicar no App Store oficial:

1. Publique imagens Docker em um registry (Docker Hub, GHCR) com tags específicas (nunca `latest`)
2. Substitua `build:` por `image:` no compose
3. Adicione `icon.png` (192x192) e `screenshot-1.png` (1280x720) na pasta `casaos/`
4. Atualize a URL do `icon` em `x-casaos` para `https://raw.githubusercontent.com/SEU_USER/SEU_REPO/main/casaos/icon.png`
5. Siga o [CONTRIBUTING do CasaOS-AppStore](https://github.com/IceWhaleTech/CasaOS-AppStore/blob/main/CONTRIBUTING.md)
