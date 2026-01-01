# 📖 Devocional WhatsApp Bot

Bot automatizado para envio diário de textos bíblicos devocionais via WhatsApp, desenvolvido em TypeScript com Bun. **Arquitetura completamente local e autônoma.**

## 🎯 Características

- ✅ **100% Local**: Roda completamente na sua máquina, sem dependências externas
- 🤖 **Automatizado**: Envio diário com cron interno configurável
- 🔧 **Configurável**: Horários e mensagens personalizáveis
- 📱 **WhatsApp Nativo**: Integração via WebSocket (Baileys)
- 🚀 **Moderno**: TypeScript + Bun para máxima performance
- 🪶 **Leve**: Consumo de memória otimizado (< 100MB) sem necessidade de Chrome
- 🔒 **Confiável**: Tratamento de erros e reconexão automática
- 🛡️ **Seguro**: Endpoints protegidos por token
- 💾 **Persistente**: Sessão WhatsApp salva em arquivos locais
- 🐳 **Docker**: Containerizado para fácil deployment

## 🏛️ Arquitetura

Arquitetura local autônoma com agendamento interno e armazenamento em arquivos.

```mermaid
graph TD
    A[Aplicação Inicia] --> B[Scheduler Ativo]
    B --> C[Cron: 06:00 Diário]
    C --> D[Carrega Devocional do Dia]
    D --> E[Verifica Conexão WhatsApp]
    E --> F{Conectado?}
    F -->|Não| G[Gera QR Code]
    F -->|Sim| H[Envia Mensagem]
    H --> I[Log Sucesso]
    G --> J[Aguarda Scan]
    J --> H
    
    K[API REST] --> L[Endpoints Manuais]
    L --> M[/send - Envio Manual]
    L --> N[/health - Status]
    L --> O[/qr - Autenticação]
    L --> P[/scheduler/* - Controle]
    
    Q[Armazenamento Local] --> R[./tokens/ - Sessão WA]
    Q --> S[./data/ - Devocionais]
```

## 🛠️ Tecnologias

- **Runtime**: [Bun](https://bun.sh/) 
- **Linguagem**: TypeScript
- **WhatsApp API**: [Baileys](https://github.com/WhiskeySockets/Baileys)
- **Agendamento**: [node-cron](https://github.com/node-cron/node-cron)
- **Containerização**: Docker & Docker Compose
- **Armazenamento**: Sistema de arquivos local

## 📋 Pré-requisitos

- [Bun](https://bun.sh/docs/installation) instalado
- Conta WhatsApp para o bot
- Grupo WhatsApp onde enviar as mensagens
- **Para produção**: Conta no [MongoDB Atlas](https://www.mongodb.com/atlas) (gratuito, 512MB)

## 🚀 Instalação e Configuração Local

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/devocional-picgama.git
cd devocional-picgama
```

### 2. Instale as dependências

```bash
bun install
```

### 3. Configure as variáveis de ambiente

```bash
cp .env.example .env
```

Edite o arquivo `.env`:

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
```

### 4. Configure os textos devocionais

Edite o arquivo `data/readings-2026.json` com o plano de leitura.

## 🎮 Como usar

### Desenvolvimento

```bash
# Executar em modo desenvolvimento
bun run dev

# Testar conexão WhatsApp
bun run dev test

# Enviar mensagem teste via comando
bun run dev send
```

## 🐳 Execução com Docker

### Desenvolvimento

```bash
# Executar em modo desenvolvimento
bun run docker:dev
```

### Produção

```bash
# Construir e executar
docker compose up -d

# Ver logs
docker compose logs -f

# Parar
docker compose down
```

### Variáveis de Ambiente

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `GROUP_CHAT_ID` | ID do grupo WhatsApp (obrigatório) | - |
| `WHATSAPP_SESSION_NAME` | Nome da sessão | `devocional-bot` |
| `SEND_TIME` | Horário do envio (HH:MM) | `06:00` |
| `TIMEZONE` | Fuso horário | `America/Sao_Paulo` |
| `PORT` | Porta do servidor | `3000` |
| `DEBUG` | Logs detalhados | `false` |
| `AUTH_TOKEN` | Token para proteger endpoints | - |
| `CONFIG_USER` | Usuário do painel admin | - |
| `CONFIG_PASSWORD` | Senha do painel admin | - |

## 📅 Agendamento Automático

O bot possui um sistema de cron interno que executa automaticamente o envio diário. Configuração via variáveis de ambiente:

- `SEND_TIME`: Horário do envio no formato HH:MM (padrão: 06:00)
- `TIMEZONE`: Fuso horário (padrão: America/Sao_Paulo)

### Controle via API

- `GET /scheduler/status` - Status do agendador
- `POST /scheduler/start` - Iniciar agendador (requer autenticação)
- `POST /scheduler/stop` - Parar agendador (requer autenticação)

### Logs do Scheduler

O sistema registra automaticamente:
- Execuções programadas
- Tentativas de retry em caso de falha
- Status de conexão WhatsApp
- Sucessos e erros de envio

## 🛡️ Segurança

Endpoints protegidos por token Bearer (`AUTH_TOKEN`):
- `POST /send` - Envio manual
- `POST /scheduler/start` - Controle do agendador  
- `POST /scheduler/stop` - Controle do agendador
- `GET /qr` - QR Code de autenticação

Painel administrativo protegido por Basic Auth (`CONFIG_USER` e `CONFIG_PASSWORD`):
- `GET /config` - Interface de administração

### Teste Manual

```bash
# Envio manual
curl -X POST http://localhost:3000/send \
  -H "Authorization: Bearer seu_token_secreto"

# Status do agendador
curl http://localhost:3000/scheduler/status
```

## 🔧 Resolução de Problemas

### Persistência de Sessão
A sessão do WhatsApp é salva em `./tokens/baileys_auth_info/`. Para manter a autenticação:
- Certifique-se de que o volume Docker está configurado corretamente
- Não delete o diretório `./tokens/` 
- Em caso de problemas, acesse `/qr?reconnect=true` para nova autenticação

### WhatsApp Desconectado
Se o WhatsApp desconectar:
1. Acesse `http://localhost:3000/qr`
2. Se necessário, adicione `?reconnect=true` para forçar nova autenticação
3. Escaneie o novo QR Code
4. A sessão será salva automaticamente em arquivos locais

### Problemas de Agendamento
- Verifique os logs: `docker compose logs -f`
- Confirme o fuso horário: `TIMEZONE=America/Sao_Paulo`
- Teste o envio manual: `POST /send`
- Verifique status: `GET /scheduler/status`

## 📡 API Endpoints

### Públicos
- `GET /` - Página inicial com documentação
- `GET /health` - Status da aplicação e scheduler
- `GET /readings` - Lista todas as leituras
- `GET /readings/today` - Leitura do dia atual

### Protegidos (requer AUTH_TOKEN)
- `POST /send` - Envio manual do devocional
- `GET /qr` - Interface de autenticação WhatsApp
- `GET /qr/image` - Imagem do QR Code
- `GET /scheduler/status` - Status do agendador
- `POST /scheduler/start` - Iniciar agendador
- `POST /scheduler/stop` - Parar agendador

### Administrativo (requer CONFIG_USER/PASSWORD)
- `GET /config` - Painel de administração completo

### Desenvolvimento
- `GET /docs` - Swagger UI (apenas em desenvolvimento)
- `GET /api-docs` - OpenAPI Spec JSON (apenas em desenvolvimento)

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para detalhes.
