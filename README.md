# 📖 Devocional WhatsApp Bot

Bot automatizado para envio diário de textos bíblicos devocionais via WhatsApp, desenvolvido em TypeScript com Bun.

## 🎯 Características

- ✅ **100% Gratuito**: Usa Baileys (API gratuita) + hospedagem gratuita (Render.com) + MongoDB Atlas (512MB grátis)
- 🤖 **Automatizado**: Envio diário acionado via GitHub Actions
- 🔧 **Configurável**: Horários e mensagens personalizáveis
- 📱 **WhatsApp Nativo**: Integração via WebSocket (Baileys)
- 🚀 **Moderno**: TypeScript + Bun para máxima performance
- 🪶 **Leve**: Consumo de memória otimizado (< 100MB) sem necessidade de Chrome
- 🔒 **Confiável**: Tratamento de erros e reconexão automática
- 🛡️ **Seguro**: Endpoint de disparo protegido por token
- 💾 **Persistente**: Sessão WhatsApp salva no MongoDB, mantém autenticação entre reinicializações

## 🏛️ Arquitetura

O bot utiliza uma arquitetura híbrida onde a aplicação fica hospedada no Render.com mantendo a sessão do WhatsApp, e o GitHub Actions atua como um "gatilho" diário para acordar a aplicação e disparar o envio.

```mermaid
sequenceDiagram
    participant GHA as GitHub Actions
    participant Render as Render.com App
    participant WA as WhatsApp API (Baileys)
    
    Note over GHA: Executa diariamente 07:00 BRT
    GHA->>Render: POST /send<br/>Authorization: Bearer TOKEN
    alt Token válido
        Note over Render: App acorda se dormindo
        Render->>Render: getTodaysDevotional()
        Render->>WA: Envia mensagem via Socket
        WA-->>Render: Confirmação
        Render-->>GHA: 200 OK
    else Token inválido
        Render-->>GHA: 401 Unauthorized
    end
```

## 🛠️ Tecnologias

- **Runtime**: [Bun](https://bun.sh/) 
- **Linguagem**: TypeScript
- **WhatsApp API**: [Baileys](https://github.com/WhiskeySockets/Baileys)
- **Hospedagem**: Render.com (Web Service)
- **Banco de Dados**: MongoDB Atlas (persistência de sessão)
- **Agendamento**: GitHub Actions

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
# WhatsApp Configuration
WHATSAPP_SESSION_NAME=devocional-bot
GROUP_CHAT_ID=seu_grupo_id_aqui@g.us

# Security
AUTH_TOKEN=seu_token_secreto_aqui

# Application Configuration
NODE_ENV=development
DEBUG=false
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

## ☁️ Deploy no Render.com

1. Crie uma conta no [Render.com](https://render.com/)
2. Crie um novo **Web Service** conectado ao seu repositório GitHub
3. Selecione o ambiente **Docker**
4. Configure as variáveis de ambiente no painel do Render:

| Variável | Descrição |
|----------|-----------|
| `NODE_ENV` | `production` |
| `GROUP_CHAT_ID` | ID do grupo (ex: `123456789@g.us`) |
| `WHATSAPP_SESSION_NAME` | `devocional-bot` |
| `AUTH_TOKEN` | Token secreto para proteger o envio (crie uma senha forte) |

5. Após o deploy, acesse a URL da sua aplicação `/qr` (ex: `https://sua-app.onrender.com/qr`) para escanear o QR Code.

## 🗄️ Configuração do MongoDB Atlas (Persistência de Sessão)

O bot utiliza MongoDB Atlas para persistir a sessão do WhatsApp, garantindo que a autenticação seja mantida mesmo quando o Render reinicia o serviço (comum no plano gratuito).

### Por que MongoDB Atlas?

No plano gratuito do Render, o sistema de arquivos do container é **ephemeral** (temporário). Quando o serviço "dorme" ou reinicia, todos os arquivos locais são perdidos, incluindo as credenciais de autenticação do WhatsApp. O MongoDB Atlas resolve isso armazenando a sessão em um banco de dados persistente.

### Passo a Passo

1. **Criar conta no MongoDB Atlas**
   - Acesse: https://www.mongodb.com/atlas
   - Crie uma conta gratuita (plano M0 Sandbox - 512MB grátis)

2. **Criar um cluster**
   - Clique em "Build a Database"
   - Escolha o plano **M0 Sandbox** (Free)
   - Selecione um provedor e região (recomendado: próximo ao Brasil)
   - Clique em "Create" e aguarde alguns minutos

3. **Configurar acesso ao banco**
   - Vá em **Database Access** > **Add New Database User**
   - Crie um usuário e senha (ex: `devocional_user`)
   - Escolha "Atlas admin" como privilégio
   - Clique em "Add User"

4. **Configurar acesso de rede**
   - Vá em **Network Access** > **Add IP Address**
   - Clique em "Allow Access from Anywhere" (ou adicione `0.0.0.0/0`)
   - Clique em "Confirm"
   - ⚠️ **Nota**: Para produção, considere restringir aos IPs do Render

5. **Obter string de conexão**
   - Vá em **Database** > clique em "Connect" no seu cluster
   - Escolha "Connect your application"
   - Selecione "Node.js" como driver
   - Copie a string de conexão (formato: `mongodb+srv://usuario:senha@cluster0.xxxxx.mongodb.net/`)
   - **Substitua** `<username>` e `<password>` pelas credenciais criadas no passo 3

6. **Configurar no Render**
   - No dashboard do Render, vá em **Environment**
   - Adicione as seguintes variáveis de ambiente:

| Variável | Valor | Descrição |
|----------|-------|-----------|
| `MONGODB_URI` | `mongodb+srv://usuario:senha@cluster0.xxxxx.mongodb.net/` | String de conexão completa do Atlas |
| `MONGODB_DB_NAME` | `devocional_bot` | Nome do banco de dados |
| `MONGODB_COLLECTION_NAME` | `whatsapp_auth` | Nome da coleção para armazenar a sessão |
| `NODE_ENV` | `production` | Ambiente de produção |

### Desenvolvimento Local

Para desenvolvimento local, você **não precisa** configurar MongoDB. O sistema automaticamente usa armazenamento em arquivos locais (`./tokens/`) quando `MONGODB_URI` não está definido ou quando `NODE_ENV !== 'production'`.

### Verificação

Após configurar, faça um novo deploy no Render e verifique os logs. Você deve ver:
```
✅ MongoDB connected successfully
Using MongoDB for auth state storage
```

Se aparecer erro de conexão, verifique:
- ✅ Usuário e senha estão corretos na string de conexão
- ✅ IP está liberado em "Network Access"
- ✅ Cluster está ativo (pode levar alguns minutos após criação)

## 🤖 Configuração do Agendamento (GitHub Actions)

O agendamento é feito pelo GitHub Actions para garantir que o envio ocorra mesmo se a aplicação no Render estiver "dormindo" (plano gratuito).

1. No seu repositório GitHub, vá em **Settings** > **Secrets and variables** > **Actions**
2. Adicione os seguintes Secrets:

| Secret | Descrição |
|--------|-----------|
| `SERVER_URL` | URL da sua aplicação no Render (ex: `https://sua-app.onrender.com`) |
| `AUTH_TOKEN` | O mesmo token definido nas variáveis do Render |

3. O workflow está configurado em `.github/workflows/deploy.yml` para rodar diariamente às 07:00 (Horário de Brasília).

## 🛡️ Segurança

O endpoint `/send` é protegido por um token Bearer. Qualquer requisição sem o header `Authorization: Bearer SEU_TOKEN` será rejeitada com status 401.

Para testar o envio manualmente via curl:

```bash
curl -X POST https://sua-app.onrender.com/send \
  -H "Authorization: Bearer seu_token_secreto" \
  -H "Content-Type: application/json"
```

## 🔧 Resolução de Problemas

### Render.com Free Plan
O plano gratuito do Render coloca a aplicação para dormir após 15 minutos de inatividade. Nossa arquitetura resolve isso: o GitHub Actions tenta acessar a aplicação, o que a "acorda". A requisição pode demorar um pouco mais, mas será processada.

### Persistência de Sessão
Com MongoDB Atlas configurado, a sessão do WhatsApp é mantida mesmo quando o Render reinicia o serviço. Se você ainda estiver tendo problemas de desautenticação:
1. Verifique se as variáveis `MONGODB_URI`, `MONGODB_DB_NAME` e `MONGODB_COLLECTION_NAME` estão configuradas no Render
2. Confirme que `NODE_ENV=production` está definido
3. Verifique os logs do Render para mensagens de conexão MongoDB
4. Certifique-se de que o MongoDB Atlas tem acesso de rede liberado (`0.0.0.0/0`)

### WhatsApp Desconectado
Se o WhatsApp desconectar:
1. Acesse `https://sua-app.onrender.com/qr`
2. Se necessário, adicione `?reconnect=true` para forçar nova autenticação
3. Escaneie o novo QR Code
4. Após escanear, a sessão será salva no MongoDB e persistirá entre reinicializações

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para detalhes.
