# Spec: Enviar áudio do devocional junto com a mensagem diária

**Issue**: [#2](https://github.com/leandrokanis/devocional-picgama/issues/2)
**Branch**: `enviar-udio-do-devocional-junto-com-a-mensagem-d`
**Status**: Draft
**Criado**: 2026-10-03

---

## Descrição

Hoje a mensagem diária leva só o texto com a leitura do dia, e o áudio do devocional fica num link fixo. O devocional é gravado em mp3 de 5 a 7 minutos, com cerca de 10 MB. O administrador quer anexar pelo painel o áudio de cada data, para que os destinatários recebam, no próprio WhatsApp, o texto e logo depois o áudio como mensagem de voz.

---

## Cenários de aceite

**Cenário: Anexar áudio a uma data**
- **Dado** que estou logado no painel
- **Quando** anexo um mp3 de até o limite configurado (default 15 MB) à leitura de uma data
- **Então** o áudio fica associado àquela data e posso substituí-lo ou removê-lo

**Cenário: Envio com áudio**
- **Dado** que a data de hoje tem áudio anexado
- **Quando** o envio diário dispara
- **Então** cada destinatário recebe a mensagem de texto e, em seguida, o áudio como mensagem de voz

**Cenário: Envio sem áudio**
- **Dado** que a data de hoje não tem áudio anexado
- **Quando** o envio diário dispara
- **Então** cada destinatário recebe apenas a mensagem de texto, como hoje

### Casos de borda

- Arquivo que não é mp3, ou maior que o limite: o upload é recusado com mensagem clara e o áudio anterior da data, se houver, continua valendo.
- Data sem leitura cadastrada: não é possível anexar áudio.
- Substituição: o novo arquivo toma o lugar do anterior, que deixa de ser enviado.
- O texto é entregue, mas o áudio falha para um destinatário: o texto não é reenviado e a falha do áudio fica registrada em log.
- O arquivo foi registrado, mas sumiu do disco na hora do envio: o envio sai só com texto, como no cenário sem áudio, e o problema fica registrado em log.
- Envio manual para um destinatário (botão "enviar" do painel): segue a mesma regra do envio diário, texto e depois áudio, quando houver.

---

## Requisitos funcionais

- **FR-001**: O sistema DEVE permitir que um administrador autenticado anexe um arquivo mp3 de até o limite configurável (`AUDIO_MAX_UPLOAD_MB`, default 15 MB) a uma data que tenha leitura.
- **FR-002**: O sistema DEVE recusar o upload de arquivos que não sejam mp3 ou que passem do limite, sem alterar o áudio já existente da data.
- **FR-003**: O sistema DEVE permitir substituir o áudio de uma data, de modo que só o mais recente seja enviado.
- **FR-004**: O sistema DEVE permitir remover o áudio de uma data.
- **FR-005**: O painel DEVE mostrar, na lista de leituras, quais datas têm áudio, e deixar anexar, substituir e remover o áudio de cada uma.
- **FR-006**: Quando a data do envio tiver áudio, o sistema DEVE enviar a cada destinatário a mensagem de texto e, em seguida, o áudio como mensagem de voz.
- **FR-007**: Quando a data do envio não tiver áudio, o sistema DEVE enviar apenas a mensagem de texto, com o mesmo conteúdo de hoje.
- **FR-008**: O áudio anexado DEVE persistir entre reinícios e recriações do container.
- **FR-009**: Os endpoints de upload, substituição e remoção DEVEM exigir autenticação, como os demais endpoints de escrita.
- **FR-010**: A falha no envio do áudio para um destinatário NÃO DEVE impedir o envio para os demais nem desfazer o texto já enviado.

---

## Entidades e dados

- **Áudio do devocional**: o arquivo de áudio de uma data de leitura. Atributos: data (única, no mesmo formato `YYYY-MM-DD` das leituras), referência ao arquivo armazenado, nome original, tamanho, tipo e data de envio do arquivo. É no máximo um por data.

---

## Escopo

### Componentes em escopo
- `apps/api` — modelo e migração para o áudio por data; endpoints autenticados para anexar, substituir, remover e consultar o áudio; inclusão da informação de áudio na listagem de leituras; envio de mídia pelo serviço de WhatsApp; fluxo de envio diário e por destinatário (`src/index.ts`, `src/services/devotional.ts`, `src/services/whatsapp.ts`, `prisma/schema.prisma`).
- `apps/ui` — página de leituras (`src/pages/readings-page.tsx`) com status e ações de áudio; tipos da API (`src/types/api.ts`); proxy Nginx (`nginx.conf`) aceitando corpo de requisição de até 20 MB (`client_max_body_size 20m`).
- `packages/shared` — tipos de leitura/áudio, se a UI e a API passarem a compartilhá-los.
- `docker-compose.yml` / `CASAOS.md` — envs `AUDIO_DIR` (`/app/data/audio`, dentro do volume `./data`) e `AUDIO_MAX_UPLOAD_MB` (default 15).

### Fora de escopo
- Gravar áudio pelo painel.
- Áudio fixo para todos os dias.
- Vídeo ou outros tipos de mídia.
- Edição das leituras (`data/readings-2026.json` continua sendo a fonte das datas e leituras).
- Mudança no horário ou na lógica do agendador (`src/services/scheduler.ts`).
- Gestão de destinatários.

### Integrações externas
- WhatsApp, via Baileys (`@whiskeysockets/baileys`): envio de mensagem de áudio como mensagem de voz.

---

## Decisões

- **Conversão para nota de voz**: o administrador envia mp3; a API converte para ogg/opus (mono, 32 kbps, `-application voip`) com ffmpeg no momento do upload e guarda só o `.ogg` em `<AUDIO_DIR>/<YYYY-MM-DD>.ogg`. Mp3 inválido (falha do ffmpeg) é recusado no upload, com o áudio anterior intacto.
- **Link fixo 🎧**: a linha "🎧 Devocional em áudio" (`https://is.gd/rjLzat`) é omitida do texto quando a data tem áudio e o envio leva a nota de voz; sem áudio (ou com o arquivo sumido do disco), o texto sai idêntico ao de hoje, com a linha.
- **Envio manual por destinatário**: tanto o envio diário (agendador e `POST /send`) quanto o envio manual (`POST /recipients/:id/send`) passam pelo mesmo caminho: texto e, se o texto foi entregue, a nota de voz.
- **Limite de tamanho**: configurável por `AUDIO_MAX_UPLOAD_MB`, default 15 MB (os arquivos reais giram em torno de 10 MB). O Nginx aceita corpo de até 20 MB.
- **Armazenamento**: arquivos no volume persistente que já existe (`./data` → `/app/data`, em `AUDIO_DIR=/app/data/audio`); o SQLite guarda só os metadados (tabela `devotional_audios`).

## Pressupostos

- Apenas administradores autenticados, com o mesmo token do painel, gerenciam os áudios. Não há perfis novos.
