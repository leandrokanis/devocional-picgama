# Plan: Enviar áudio do devocional junto com a mensagem diária

**Issue**: #2
**Feature**: specs/2-send-devotional-audio
**Data**: 2026-10-03

---

## Resumo

O administrador anexa, substitui, ouve e remove pelo painel o mp3 de cada data de leitura. A API valida o arquivo, converte para ogg/opus (mono, 32 kbps) com ffmpeg no momento do upload, grava o arquivo em `AUDIO_DIR` e os metadados numa tabela Prisma. No envio diário e no envio por destinatário, cada destinatário recebe o texto e, logo em seguida, o áudio como nota de voz (`ptt: true`). Sem áudio, o texto sai idêntico ao de hoje.

---

## Componentes em escopo

- `apps/api` — modelo e migração `DevotionalAudio`, `AudioService` + conversor ffmpeg, serviço de envio extraído do `index.ts`, nota de voz no `WhatsAppService`, rotas de áudio e campo `audio` em `GET /readings`, Dockerfile com ffmpeg.
- `apps/ui` — coluna "Áudio" na página de leituras, modal com player, `client_max_body_size` no nginx.
- `packages/shared` — tipo `DevotionalAudio` e campo `audio` em `DevotionalReading`.
- `docker-compose.yml` / `CASAOS.md` — envs `AUDIO_DIR` e `AUDIO_MAX_UPLOAD_MB`.

---

## Contexto de código

| Situação | Path |
|---|---|
| Alterar | `apps/api/prisma/schema.prisma` — model `DevotionalAudio` (`date` @id, `filePath`, `originalName`, `sizeBytes`, `createdAt`, `updatedAt`; `@@map("devotional_audios")`) |
| Criar | `apps/api/prisma/migrations/<timestamp>_devotional_audio/migration.sql` — tabela `devotional_audios` |
| Criar | `apps/api/src/services/audio-converter.ts` — interface `AudioConverter` (`toVoiceNote(inputPath, outputPath)`) e `FfmpegAudioConverter` via `child_process.spawn` |
| Criar | `apps/api/src/services/audio.ts` — `AudioService` (save/get/remove/list/readFile por data), recebe `PrismaClient`, `AudioConverter`, `audioDir` e `maxBytes` no construtor |
| Criar | `apps/api/src/services/audio.test.ts` — testes do `AudioService` com SQLite temporário e conversor fake |
| Criar | `apps/api/src/services/devotional-sender.ts` — orquestra texto→áudio por destinatário, extraído de `DevotionalBot` |
| Criar | `apps/api/src/services/devotional-sender.test.ts` — testes do fluxo de envio com WhatsApp fake |
| Alterar | `apps/api/src/services/devotional.ts` — `formatMessage(devotional, { hasAudio })` omite a linha 🎧 quando `hasAudio` |
| Alterar | `apps/api/src/services/devotional.test.ts` — casos com e sem `hasAudio` |
| Alterar | `apps/api/src/services/whatsapp.ts` — `sendVoiceMessage(audio: Buffer, chatId)` com `mimetype: 'audio/ogg; codecs=opus'`, `ptt: true` |
| Alterar | `apps/api/src/index.ts` — `DevotionalBot` usa `DevotionalSender`; rotas `PUT`/`DELETE`/`GET /readings/:date/audio`; `GET /readings` com `audio`; leitura de `AUDIO_DIR`/`AUDIO_MAX_UPLOAD_MB`; 413 cedo por `Content-Length` |
| Alterar | `apps/api/src/swagger.json` — documentar as rotas novas e o campo `audio` |
| Alterar | `apps/api/Dockerfile` — `apk add --no-cache ffmpeg` |
| Alterar | `packages/shared/src/types.ts` — `DevotionalAudio` e `audio: DevotionalAudio \| null` em `DevotionalReading` |
| Alterar | `apps/ui/src/pages/readings-page.tsx` — coluna Áudio (anexar/ouvir/substituir/remover), `useMutation` por linha, modal com `<audio controls>` |
| Alterar | `apps/ui/nginx.conf` — `client_max_body_size 20m` em `location /api/` |
| Alterar | `docker-compose.yml` — `AUDIO_DIR=/app/data/audio`, `AUDIO_MAX_UPLOAD_MB=${AUDIO_MAX_UPLOAD_MB:-15}` e descrição CasaOS |
| Alterar | `CASAOS.md` — documentar as envs novas |
| Alterar | `specs/2-send-devotional-audio/spec.md` — limite de 15 MB configurável e pressupostos decididos |

---

## Comandos de verificação

| Componente | Um arquivo de teste | Suíte | Checagem estática |
|---|---|---|---|
| `apps/api` | `yarn workspace @devocional/api vitest run <arquivo>` | `yarn workspace @devocional/api test` | `yarn workspace @devocional/api lint` |
| `apps/ui` | — | — | `yarn workspace @devocional/ui lint` |
| `packages/shared` | — | — | `yarn workspace @devocional/api lint` (consumidor) |

Pré-requisitos:
- `yarn install` na raiz da worktree (hoje não há `node_modules`).
- `yarn workspace @devocional/api prisma:generate` depois da mudança no schema.
- Os testes de `AudioService` criam um `.db` temporário e aplicam as migrações (`prisma migrate deploy` com `DATABASE_URL` apontando para ele) no setup. Não precisam de container.
- ffmpeg no PATH só para a verificação manual ponta a ponta. Os testes automatizados não dependem dele.

---

## Decisões técnicas

| Decisão | Escolha do desenvolvedor | Justificativa |
|---|---|---|
| Formato da nota de voz | Converter mp3 → ogg/opus no upload, com ffmpeg; guardar só o `.ogg` | Toca como nota de voz em todos os clientes (inclusive iOS); a conversão roda uma vez; arquivo inválido falha já no painel |
| Armazenamento | Tabela Prisma `DevotionalAudio` + arquivo `<AUDIO_DIR>/<YYYY-MM-DD>.ogg` | Segue o padrão Prisma/SQLite, guarda metadados para o painel e mantém o banco enxuto |
| Contrato de upload | `PUT /readings/:date/audio` multipart (campo `file`, `req.formData()`); `DELETE` remove; 400 tipo/conversão, 404 data sem leitura, 413 tamanho, 401 sem token | Idempotente (anexar = substituir), padrão do browser, sem dependência nova |
| Limite de tamanho | `AUDIO_MAX_UPLOAD_MB`, default 15; nginx `client_max_body_size 20m`; API rejeita cedo por `Content-Length` e confere o tamanho real | Arquivos reais ficam em torno de 10 MB; folga sem recusar à toa. Muda o FR-001 da spec |
| Validação de mp3 | Extensão `.mp3` ou mime `audio/mpeg` + exit ≠ 0 do ffmpeg ⇒ 400; áudio anterior intacto | Pega o erro comum sem ffprobe à parte |
| Onde mora a lógica | `AudioService` + `AudioConverter` injetados (`audio.ts`, `audio-converter.ts`) | Testável sem ffmpeg; `DevotionalService` continua só lendo o JSON |
| Fluxo de envio | Buffer lido uma vez; por destinatário: texto, e se ok, `sendVoiceMessage`; sucesso conta textos; falha do áudio → `logger.warn`; mesmo caminho no envio por destinatário | Atende "texto e, em seguida, o áudio" e o FR-010 |
| Link fixo 🎧 | Omitido quando a data tem áudio; mantido sem áudio | O link fica redundante com o áudio, e o cenário sem áudio pede "como hoje" |
| Listagem e preview | `GET /readings` ganha `audio: {originalName, sizeBytes, updatedAt} \| null`; `GET /readings/:date/audio` (auth, aceita `?token=`) serve o `.ogg` | Uma consulta para a tabela; ouvir antes do disparo evita enviar o áudio errado |
| UI | Coluna "Áudio" inline (FileButton anexar/substituir, Ouvir em modal, Remover com confirmação), loading por linha, erro em `Alert`, invalida `['readings']` | Um clique por linha, sem 365 players na página |
| Testes | `AudioService` com SQLite temporário real + conversor fake; envio extraído para `devotional-sender.ts` e testado com WhatsApp fake; rotas e UI verificadas manualmente | Exercita o Prisma de verdade; dublês só nas fronteiras externas (ffmpeg, WhatsApp) |
| Parâmetros opus | `-c:a libopus -b:a 32k -ac 1 -ar 48000 -application voip` | Perfil de nota de voz; ~1,5 MB por 7 min, upload leve por destinatário |
| Pasta dos áudios | Env `AUDIO_DIR` (`/app/data/audio` no compose); default `<repo>/data/audio` resolvido por `__dirname`; `mkdir -p` na inicialização | Não depende do cwd e cai no volume persistente (FR-008) |

---

## Ordem de implementação

- [x] **Atualizar a spec** — FR-001 passa a dizer "até o limite configurável (default 15 MB)"; os pressupostos sobre conversão, link 🎧 e envio manual viram decisões registradas.
- [x] **Modelo e migração** — model `DevotionalAudio` no `schema.prisma`, migração SQL nova, `prisma:generate`; tipos `DevotionalAudio` e `audio` em `packages/shared/src/types.ts`.
- [x] **AudioConverter** — interface + `FfmpegAudioConverter` (spawn, parâmetros opus decididos, rejeita em exit ≠ 0 com o stderr no erro).
- [x] **AudioService.save** — valida extensão/mime e tamanho; grava o mp3 temporário em `AUDIO_DIR`; converte para um `.ogg` temporário; faz rename atômico para `<date>.ogg`; upsert no Prisma; apaga os temporários sempre e, se o upsert falhar, desfaz o arquivo. Testes: anexar cria registro e arquivo; substituir troca os dois; falha de conversão ou não-mp3 lança erro e mantém o áudio anterior; acima do limite lança erro.
- [x] **AudioService.get/list/remove/readFile** — `remove` apaga o registro e depois o arquivo (tolerando arquivo ausente); `readFile` devolve `null` e loga quando o registro existe mas o arquivo sumiu; `list` devolve o mapa data → metadados para a listagem. Testes cobrindo cada caso.
- [x] **formatMessage com hasAudio** — omite a linha 🎧 quando `hasAudio`; sem a flag, a saída é idêntica à atual. Testes em `devotional.test.ts`.
- [x] **WhatsAppService.sendVoiceMessage** — envia `{ audio, mimetype: 'audio/ogg; codecs=opus', ptt: true }`; retorna `false` desconectado ou em erro, como `sendMessage`.
- [x] **DevotionalSender** — extrai de `DevotionalBot` o envio para a lista de destinatários e para um destinatário só; lê o áudio da data uma vez; texto → nota de voz por destinatário; o sucesso conta textos; falha do áudio só gera `logger.warn` e não interrompe os demais; sem áudio (ou arquivo sumido), só texto com o link 🎧. Testes com WhatsApp e AudioService fakes cobrindo os três cenários da issue e a falha parcial.
- [x] **Rotas da API** — em `index.ts`: instanciar `AudioService` com as envs; `PUT /readings/:date/audio` (auth, 413 por `Content-Length` antes de ler o corpo, `req.formData()`, 404 se a data não tem leitura, 400/413 dos erros de validação); `DELETE` (auth, 404 sem áudio); `GET` (auth, `audio/ogg`, 404 sem áudio); `GET /readings` com `audio` por item; `DevotionalBot` delegando ao `DevotionalSender`. Atualizar `swagger.json`.
- [x] **Infra** — `apk add ffmpeg` no `apps/api/Dockerfile`; `client_max_body_size 20m` no `apps/ui/nginx.conf`; envs `AUDIO_DIR` e `AUDIO_MAX_UPLOAD_MB` no `docker-compose.yml` (com descrição CasaOS) e no `CASAOS.md`.
- [x] **UI** — em `readings-page.tsx`: coluna Áudio; sem áudio → FileButton "Anexar mp3" (`accept="audio/mpeg,.mp3"`); com áudio → nome/tamanho, "Ouvir" (modal com `<audio controls src="/api/readings/:date/audio?token=…">`), "Substituir" (FileButton) e "Remover" (confirmação); uploads com `FormData`, sobrescrevendo o `Content-Type` JSON padrão do client; loading por linha; erro em `Alert`; invalidar `['readings']` ao concluir.

---

## Riscos

- **Upload de mídia repetido por destinatário no Baileys**: cada `sendMessage` com buffer refaz o upload. Com ~1,5 MB por arquivo e poucos destinatários isso é aceitável. Se o envio ficar lento, avaliar `mediaCache` ou `prepareWAMessageMedia` em outra issue.
- **ffmpeg ausente no ambiente**: no dev ele não está instalado. O upload falharia com 400 por conversão. Logar uma mensagem explícita ("ffmpeg not found") quando o spawn der `ENOENT`, para diferenciar de mp3 inválido.
- **Corpo inteiro em memória**: o `createServer` atual acumula o corpo num Buffer. O 413 por `Content-Length` antes da leitura limita o pior caso a ~15 MB por requisição.

---

## Fora de escopo

- Gravar áudio pelo painel; áudio fixo para todos os dias; vídeo.
- Aceitar formatos além de mp3.
- Edição das leituras (`data/readings-2026.json` continua sendo a fonte).
- Mudanças no agendador (`src/services/scheduler.ts`) e na gestão de destinatários.
- Limpeza automática de áudios de datas passadas.
- Testes automatizados de UI e de rotas HTTP.

---

## Verificação

- [ ] `yarn install`, `prisma:generate` e migração aplicada; ffmpeg instalado (ou stack via `docker compose up -d --build`).
- [x] `yarn workspace @devocional/api test` e os dois `lint` verdes.
- [ ] **Anexar áudio a uma data**: logado no painel, anexar um mp3 de ~10 MB a uma data com leitura → a linha mostra nome e tamanho; "Ouvir" toca o áudio convertido; o arquivo `<AUDIO_DIR>/<data>.ogg` existe.
- [ ] Substituir por outro mp3 → "Ouvir" toca o novo; só um `.ogg` para a data.
- [ ] Remover → a linha volta a "Anexar mp3"; registro e arquivo apagados.
- [ ] Enviar um `.txt` renomeado para `.mp3`, ou um arquivo acima do limite → erro claro no painel e áudio anterior intacto.
- [ ] Reiniciar o container → o áudio continua associado à data.
- [ ] **Envio com áudio**: com áudio na data de hoje, `POST /send` → cada destinatário recebe o texto sem a linha 🎧 e, em seguida, a nota de voz.
- [ ] **Envio sem áudio**: sem áudio hoje, `POST /send` → cada destinatário recebe só o texto, idêntico ao atual (com a linha 🎧).
- [ ] `POST /recipients/:id/send` segue as mesmas regras.
