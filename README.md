# 📖 Devocional WhatsApp Bot

Bot automatizado para envio diário de textos bíblicos devocionais via WhatsApp, desenvolvido em TypeScript com Bun.

## 🎯 Características

- ✅ **100% Gratuito**: Usa WPPConnect (API gratuita) + hospedagem gratuita
- 🤖 **Automatizado**: Envio diário programado via cron
- 🔧 **Configurável**: Horários e mensagens personalizáveis
- 📱 **WhatsApp Nativo**: Integração completa via WPPConnect
- 🚀 **Moderno**: TypeScript + Bun para máxima performance
- 🔒 **Confiável**: Tratamento de erros e reconexão automática

## 🛠️ Tecnologias

- **Runtime**: [Bun](https://bun.sh/) 
- **Linguagem**: TypeScript
- **WhatsApp API**: [WPPConnect](https://wppconnect.io/)
- **Agendamento**: node-cron
- **Hospedagem**: Railway.app / Render.com / GitHub Actions

## 📋 Pré-requisitos

- [Bun](https://bun.sh/docs/installation) instalado
- Conta WhatsApp para o bot
- Grupo WhatsApp onde enviar as mensagens

## 🚀 Instalação

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

Edite o arquivo `.env` com suas configurações:

```env
# WhatsApp Configuration
WHATSAPP_SESSION_NAME=devocional-bot
GROUP_CHAT_ID=seu_grupo_id_aqui@g.us

# Schedule Configuration
SEND_TIME=07:00
TIMEZONE=America/Sao_Paulo

# Application Configuration
NODE_ENV=production
DEBUG=false
```

### 4. Configure os textos devocionais

Edite o arquivo `data/readings-2026.json` com o plano de leitura:

```json
[
  {
    "date": "2026-01-01",
    "reading": "Gênesis 1-3"
  }
]
```

## 🎮 Como usar

### Desenvolvimento

```bash
# Executar em modo desenvolvimento
bun run dev

# Testar conexão WhatsApp
bun run dev test

# Enviar mensagem teste
bun run dev send
```

### Produção

```bash
# Build do projeto
bun run build

# Executar bot em produção
bun run start

# Ou executar diretamente
bun run src/index.ts
```

## 📱 Configuração do WhatsApp

### 1. Primeira execução

Na primeira execução, o bot irá gerar um QR Code no terminal:

```bash
bun run dev test
```

### 2. Escaneie o QR Code

- Abra o WhatsApp no seu celular
- Vá em **Configurações** > **Aparelhos conectados**
- Toque em **Conectar um aparelho**
- Escaneie o QR Code exibido no terminal

### 3. Obtenha o ID do grupo

Após conectar, adicione o bot ao grupo desejado e execute:

```bash
bun run dev test
```

O ID do grupo será exibido no log. Atualize o `.env` com este ID.

## 🌐 Hospedagem Gratuita

### Railway.app (Recomendado)

1. Crie conta no [Railway.app](https://railway.app/)
2. Conecte seu repositório GitHub
3. Configure as variáveis de ambiente
4. Deploy automático!

### Render.com

1. Crie conta no [Render.com](https://render.com/)
2. Conecte seu repositório GitHub  
3. Use o arquivo `render.yaml` incluído
4. Configure as variáveis de ambiente:

```env
NODE_ENV=production
PORT=10000
GROUP_CHAT_ID=seu_grupo_id_aqui@g.us
WHATSAPP_SESSION_NAME=devocional-bot
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
SEND_TIME=07:00
TIMEZONE=America/Sao_Paulo
```

**⚠️ Importante para Render.com**: O WhatsApp pode não funcionar em ambiente de produção devido às limitações do Puppeteer. Neste caso, o bot continuará funcionando e registrará as mensagens nos logs.

### GitHub Actions (Serverless)

1. Configure os secrets no GitHub:
   - `WHATSAPP_SESSION_NAME`
   - `GROUP_CHAT_ID`
   - `SEND_TIME`
   - `TIMEZONE`

2. O workflow em `.github/workflows/deploy.yml` executará diariamente

## 📊 Comandos disponíveis

| Comando | Descrição |
|---------|-----------|
| `bun run dev` | Executa bot em desenvolvimento |
| `bun run dev test` | Testa conexão WhatsApp |
| `bun run dev send` | Envia mensagem do dia atual |
| `bun run build` | Compila o projeto |
| `bun run start` | Executa em produção |

## 🔧 Configurações Avançadas

### Formato da Mensagem

O formato padrão da mensagem é:

```
📖 Devocional - 26/12/2025

AT1: Gênesis 1:1-10
AT2: Salmos 1
NT: João 3:16-21
```

Para personalizar, edite o método `formatMessage` em `src/services/devotional.ts`.

### Agendamento Personalizado

Modifique a variável `SEND_TIME` no `.env`:

```env
SEND_TIME=07:00  # 07:00 da manhã
SEND_TIME=19:30  # 19:30 da noite
```

### Logs e Debug

Para ativar logs detalhados:

```env
DEBUG=true
NODE_ENV=development
```

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para detalhes.

## 🆘 Suporte

- 📧 **Issues**: [GitHub Issues](https://github.com/seu-usuario/devocional-picgama/issues)
- 📖 **Documentação**: [WPPConnect Docs](https://wppconnect.io/docs/)
- 💬 **Comunidade**: [WPPConnect Discord](https://discord.gg/wppconnect)

## 🔧 Resolução de Problemas

### Erro: "Protocol error (Target.setDiscoverTargets): Target closed"

Este erro ocorre quando o Puppeteer não consegue inicializar o browser em ambiente de produção (comum no Render.com).

**Solução**:
1. O bot continuará funcionando e registrará as mensagens nos logs
2. Para forçar o modo sem WhatsApp, adicione a variável: `DISABLE_WHATSAPP=true`
3. Use uma plataforma com melhor suporte ao Puppeteer (Railway.app)

### WhatsApp não conecta

1. Verifique se o `GROUP_CHAT_ID` está correto
2. Execute `bun run dev test` para gerar novo QR Code
3. Certifique-se de que o bot está no grupo do WhatsApp

### Deploy falha no Render.com

1. Verifique se todas as variáveis de ambiente estão configuradas
2. O Dockerfile foi otimizado para ambientes headless
3. O bot funcionará mesmo se o WhatsApp falhar (modo fallback)

### Mensagens não são enviadas no horário

1. Verifique o `TIMEZONE` no `.env`
2. Confirme o formato do `SEND_TIME` (HH:MM)
3. Monitore os logs para erros de agendamento

## ⚠️ Avisos Importantes

- **Uso Responsável**: Respeite os termos de uso do WhatsApp
- **Rate Limiting**: Evite spam - o bot já tem controles internos
- **Backup**: Mantenha backup dos dados devocionais
- **Monitoramento**: Monitore logs para garantir funcionamento
- **Produção**: Em ambiente de produção, o bot pode funcionar sem WhatsApp (apenas logs)

---

**Desenvolvido com ❤️ para a comunidade cristã**