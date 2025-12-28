# Configuração MongoDB para Persistência de Sessão WhatsApp

## Configuração no Render

### 1. Variáveis de Ambiente Obrigatórias

No dashboard do Render, adicione as seguintes variáveis de ambiente:

```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
MONGODB_DB_NAME=devocional_bot
MONGODB_COLLECTION_NAME=whatsapp_auth
```

### 2. Configuração MongoDB Atlas

1. **Criar conta gratuita:** https://www.mongodb.com/atlas
2. **Criar cluster M0 (gratuito):** Escolha uma região próxima
3. **Configurar acesso:**
   - Database Access: Criar usuário com senha
   - Network Access: Adicionar `0.0.0.0/0` (necessário para Render)
4. **Obter string de conexão:** Connect → Connect your application

### 3. Exemplo de String de Conexão

```
mongodb+srv://devocional_user:sua_senha_aqui@cluster0.abc123.mongodb.net/
```

### 4. Variáveis de Ambiente Completas

```bash
# MongoDB (Obrigatório para produção)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
MONGODB_DB_NAME=devocional_bot
MONGODB_COLLECTION_NAME=whatsapp_auth

# WhatsApp (Existentes)
GROUP_CHAT_ID=seu_grupo@g.us
WHATSAPP_SESSION_NAME=devocional-bot
SEND_TIME=07:00
TIMEZONE=America/Sao_Paulo
DEBUG=false

# Server (Existentes)
NODE_ENV=production
PORT=3000
SERVER_PORT=3000
SERVER_HOST=0.0.0.0
```

## Benefícios da Implementação

- ✅ **Persistência de sessão:** Mantém autenticação entre reinicializações
- ✅ **Compatibilidade com Render Free:** Funciona com o plano gratuito
- ✅ **Fallback local:** Usa arquivos locais em desenvolvimento
- ✅ **Escalabilidade:** Permite múltiplas instâncias
- ✅ **Confiabilidade:** Reduz re-autenticações manuais

## Desenvolvimento Local

Para desenvolvimento local, o sistema automaticamente usa armazenamento em arquivos se `MONGODB_URI` não estiver configurado ou se `NODE_ENV` não for `production`.
