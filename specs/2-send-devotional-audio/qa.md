# QA — #2 — Enviar áudio do devocional junto com a mensagem diária

## Plano de QA — 2026-10-03

**baseline_commit**: 2d1ff3e8b031f5f546496853fad3fe93d83a35fe
**Componentes em escopo**: `apps/api`, `apps/ui`, `packages/shared`, `docker-compose.yml` / `CASAOS.md`
**Suítes que valem como prova**:
- `apps/api`: `yarn workspace @devocional/api test` (vitest), depois de `yarn install` e `yarn workspace @devocional/api prisma:generate`; um arquivo: `yarn workspace @devocional/api vitest run <arquivo>`
- `apps/api` estático: `yarn workspace @devocional/api lint`
- `apps/ui` estático: `yarn workspace @devocional/ui lint` (também cobre o consumo de `packages/shared`)
- `packages/shared`: sem suíte própria; vale o lint dos dois consumidores
- Rotas, UI, infra e conversor ffmpeg: inspeção do diff + lint, como o plan.md decide (testes de rota e de UI estão fora de escopo). Falta de teste automatizado nesses passos não gera PARCIAL.
- Itens manuais da seção Verificação: dependem de ffmpeg e WhatsApp, ausentes neste ambiente; ficam registrados como não executados, não como FAIL.

| Passo (plan.md) | O que precisa ser provado | Como |
|---|---|---|
| 1 — Atualizar a spec | FR-001 diz "até o limite configurável (default 15 MB)"; conversão ogg/opus, omissão do link 🎧 com áudio e envio manual por destinatário aparecem como decisões, não como pressupostos | Inspeção de `specs/2-send-devotional-audio/spec.md` no diff |
| 2 — Modelo e migração | Model `DevotionalAudio` (`date` @id, `filePath`, `originalName`, `sizeBytes`, `createdAt`, `updatedAt`, `@@map("devotional_audios")`); migração nova cria a tabela e bate com o schema; tipos `DevotionalAudio` e `audio: DevotionalAudio \| null` em `DevotionalReading` | Inspeção de `schema.prisma`, `migrations/*_devotional_audio/migration.sql` e `packages/shared/src/types.ts`; `prisma:generate` sem erro; os testes do `AudioService` rodam `migrate deploy` num SQLite temporário e usam o client gerado (schema e SQL divergentes quebram a suíte); lint de api e ui |
| 3 — AudioConverter | Interface `AudioConverter.toVoiceNote(inputPath, outputPath)`; `FfmpegAudioConverter` usa `spawn` com `-c:a libopus -b:a 32k -ac 1 -ar 48000 -application voip`; rejeita em exit ≠ 0 com o stderr na mensagem; `ENOENT` gera log/erro explícito "ffmpeg not found" | Inspeção de `audio-converter.ts` + lint. Sem ffmpeg na máquina, não há teste do conversor real. Sem o tratamento de `ENOENT` → PARCIAL |
| 4 — AudioService.save | Anexar cria registro e `<AUDIO_DIR>/<date>.ogg`; substituir troca registro e arquivo (um só `.ogg` por data); não-mp3 (extensão e mime) e falha de conversão lançam erro e deixam o áudio anterior intacto (registro e bytes); acima de `maxBytes` lança erro; temporários sempre apagados; falha do upsert desfaz o arquivo | `audio.test.ts` com SQLite temporário real e conversor fake (que escreve um `.ogg` conhecido ou falha). Mutações exigidas, todas vermelhas: tirar a checagem de tamanho; apagar o `.ogg` antigo antes de converter; não apagar temporários (o teste deve listar `AUDIO_DIR`) |
| 5 — AudioService.get/list/remove/readFile | `get` devolve metadados ou `null`; `list` devolve mapa data → `{originalName, sizeBytes, updatedAt}`; `remove` apaga registro e depois arquivo, tolerando arquivo ausente; `readFile` devolve o buffer, ou `null` + log quando o registro existe e o arquivo sumiu | `audio.test.ts`, um caso por comportamento. Mutações vermelhas: `remove` sem tolerar `ENOENT`; `readFile` lançando em vez de devolver `null` |
| 6 — formatMessage com hasAudio | Com `hasAudio: true`, sem a linha "🎧 Devocional em áudio"; sem a flag (ou `false`), saída idêntica à do baseline | `devotional.test.ts`; a comparação "idêntica" é por igualdade de string com o formato atual, não por `toContain`. Mutações vermelhas: ignorar `hasAudio`; alterar um caractere da saída sem flag |
| 7 — WhatsAppService.sendVoiceMessage | `sendVoiceMessage(audio: Buffer, chatId)` envia `{ audio, mimetype: 'audio/ogg; codecs=opus', ptt: true }`; devolve `false` desconectado ou em erro, como `sendMessage` | Inspeção de `whatsapp.ts` + lint (o plano não decidiu teste; um teste com sock fake conta a favor). Payload divergente ou exceção vazando → FAIL |
| 8 — DevotionalSender | Envio para a lista e para um destinatário passam pelo mesmo caminho; áudio lido uma vez; por destinatário, texto e, só se ok, nota de voz; sucesso conta textos; falha do áudio só gera `logger.warn` e os demais seguem; sem áudio ou arquivo sumido → só texto com a linha 🎧 | `devotional-sender.test.ts` com WhatsApp e AudioService fakes, cobrindo: com áudio, sem áudio, arquivo sumido, falha parcial do áudio, texto falho, envio a um destinatário. Mutações vermelhas: áudio antes do texto; áudio com texto falho; falha do áudio interrompe o laço; sucesso contando áudios; `hasAudio` vindo do registro e não do buffer; `readFile` por destinatário |
| 9 — Rotas da API | `AudioService` criado com `AUDIO_DIR` (default por `__dirname`, `mkdir -p`) e `AUDIO_MAX_UPLOAD_MB` (default 15); `PUT /readings/:date/audio`: auth, 413 por `Content-Length` antes de ler o corpo, `req.formData()` campo `file`, 404 data sem leitura, 400/413 dos erros do serviço; `DELETE`: auth, 404 sem áudio; `GET`: auth (aceita `?token=`), `audio/ogg`, 404 sem áudio; `GET /readings` com `audio` por item; `DevotionalBot` delega ao `DevotionalSender`; `swagger.json` documenta tudo; `:date` restrito a `YYYY-MM-DD` | Inspeção de `index.ts` e `swagger.json` + lint. Sem restrição do `:date` no path (vira nome de arquivo) → PARCIAL. Comparar `Content-Length` com `maxBytes` sem folga para o multipart → PARCIAL |
| 10 — Infra | `apk add --no-cache ffmpeg` no `apps/api/Dockerfile`; `client_max_body_size 20m` em `location /api/` do `apps/ui/nginx.conf`; `AUDIO_DIR=/app/data/audio` e `AUDIO_MAX_UPLOAD_MB=${AUDIO_MAX_UPLOAD_MB:-15}` no `docker-compose.yml` com descrição CasaOS; envs documentadas no `CASAOS.md` | Inspeção dos quatro arquivos; `AUDIO_DIR` dentro do volume persistente `./data` |
| 11 — UI | Coluna Áudio: sem áudio → FileButton "Anexar mp3" (`accept="audio/mpeg,.mp3"`); com áudio → nome/tamanho, "Ouvir" (modal com `<audio controls src="/api/readings/:date/audio?token=…">`), "Substituir" e "Remover" com confirmação; upload com `FormData` sem o `Content-Type` JSON padrão; loading por linha; erro em `Alert`; invalida `['readings']` | Inspeção de `readings-page.tsx` + `yarn workspace @devocional/ui lint`. `Content-Type` JSON mantido no upload → FAIL (o multipart quebra) |

| Critério de aceite | O que o cobre |
|---|---|
| Cenário: Anexar áudio a uma data (associar, substituir, remover) | Passos 4 e 5 (`audio.test.ts`: anexar, substituir, remover) + passos 9 e 11 por inspeção (rotas autenticadas, 404 sem leitura, UI com as três ações). A ponta a ponta pelo painel é manual e não roda aqui |
| Cenário: Envio com áudio | Passo 8 (`devotional-sender.test.ts`: ordem texto → nota de voz por destinatário, texto sem 🎧) + passo 6 (`hasAudio` omite 🎧) + passo 7 por inspeção (`ptt: true`, ogg/opus) |
| Cenário: Envio sem áudio | Passo 8 (sem áudio → só texto) + passo 6 (saída sem flag idêntica à do baseline, por igualdade de string) |
| Borda: não-mp3 ou acima do limite recusado, áudio anterior mantido (FR-002) | Passo 4 (`audio.test.ts`) + passo 9 por inspeção (400/413) |
| Borda: data sem leitura não aceita áudio | Passo 9 por inspeção (404 no `PUT`) |
| Borda: substituição — só o mais recente é enviado (FR-003) | Passo 4 (substituir troca registro e arquivo) |
| Borda: áudio falha para um destinatário (FR-010) | Passo 8 (falha parcial: texto não reenviado, `logger.warn`, demais seguem) |
| Borda: registro sem arquivo no disco na hora do envio | Passos 5 (`readFile` → `null` + log) e 8 (só texto com 🎧) |
| Borda: envio manual por destinatário segue a mesma regra | Passo 8 (caso de um destinatário no mesmo caminho) + passo 9 por inspeção (`POST /recipients/:id/send` delega ao sender) |
| FR-004 remover | Passo 5 (`remove`) + passo 9 por inspeção (`DELETE`) |
| FR-005 painel mostra quais datas têm áudio | Passo 9 (`GET /readings` com `audio`) + passo 11, por inspeção e lint |
| FR-008 persiste entre reinícios | Passo 10 por inspeção (`AUDIO_DIR` no volume `./data`) + passo 2 (metadados no SQLite) |
| FR-009 autenticação | Passo 9 por inspeção (`checkAuth` em `PUT`, `DELETE` e `GET` de áudio) |

## Rodada 1 — 2026-10-03 — working tree sobre 2d1ff3e

**baseline_commit**: 2d1ff3e8b031f5f546496853fad3fe93d83a35fe
**Componentes avaliados**: `apps/api`, `apps/ui`, `packages/shared`, `docker-compose.yml` / `CASAOS.md`
**Suítes**: api ✅ (38 / 0 falhas, 5 arquivos) · lint api ✅ · lint ui ✅ (cobre `packages/shared`)
**Mutações**: 28 rodadas, 27 mortas; todas as exigidas pela matriz vermelhas (detalhe no `tdd.md`, Rodada 1 · QA). Arquivos restaurados e conferidos byte a byte após cada uma.

### Veredito por passo

| Passo (plan.md) | Veredito | Evidência / motivo |
|---|---|---|
| 1 — Atualizar a spec | PASS | `spec.md:46` FR-001 com `AUDIO_MAX_UPLOAD_MB` (default 15 MB); `spec.md:86-91` seção Decisões com conversão opus, link 🎧, envio manual e limite |
| 2 — Modelo e migração | PASS | `schema.prisma` e `migration.sql` batem campo a campo; `audio.test.ts` "migrations create the devotional_audios table" aplica `migrate deploy` e usa o client gerado; `DevotionalAudio`/`audio` em `types.ts`, lint api e ui verdes |
| 3 — AudioConverter | PASS | `audio-converter.ts`: spawn com `-c:a libopus -b:a 32k -ac 1 -ar 48000 -application voip`; exit ≠ 0 rejeita com stderr; `ENOENT` → `logger.error("ffmpeg not found …")` + erro. `audio-converter.test.ts` (3, ffmpeg falso) mata ENOENT genérico, exit≠0 resolvendo e bitrate trocado |
| 4 — AudioService.save | PASS | `audio.test.ts` (10 casos de save). Exigidas, todas vermelhas: sem checagem de tamanho (1), apagar o `.ogg` antigo antes de converter (2), não apagar temporários (5). Extra: rollback do upsert via trigger SQLite (2), não-mp3 aceito (1) |
| 5 — AudioService.get/list/remove/readFile | PASS | `audio.test.ts`, um caso por comportamento. Exigidas vermelhas: `remove` sem tolerar `ENOENT` (1), `readFile` lançando (1); extra: `readFile` sem warn (1). Observação: inverter a ordem registro→arquivo no `remove` sobrevive (não exigida; só observável com falha do Prisma após o `rm`) |
| 6 — formatMessage com hasAudio | PASS | `devotional.test.ts` compara por `toBe` com o formato do baseline (sem flag e `hasAudio: false`) e sem a linha 🎧 com `hasAudio: true`. Exigidas vermelhas: ignorar `hasAudio` (1), um caractere da saída sem flag (2–3) |
| 7 — WhatsAppService.sendVoiceMessage | PASS | `whatsapp.ts` via `deliver` com `{ audio, mimetype: 'audio/ogg; codecs=opus', ptt: true }`; `whatsapp.test.ts` (sock fake) prova payload, `false` desconectado e `false` em erro; `ptt:false` e exceção vazando morrem |
| 8 — DevotionalSender | PASS | `devotional-sender.test.ts` (9) cobre com áudio, sem áudio, arquivo sumido, texto falho, falha parcial do áudio com `logger.warn`, envio a um destinatário e leitura única. As seis exigidas vermelhas (áudio antes do texto 4; áudio com texto falho 1; falha interrompe o laço 1–2; sucesso contando áudios 3; `hasAudio` desligado do buffer 2–4; `readFile` por destinatário 1) |
| 9 — Rotas da API | PASS | `index.ts`: `AUDIO_ROUTE` restringe `:date` a `\d{4}-\d{2}-\d{2}`; `resolveAudioConfig` (default por `__dirname`, 15 MB) + `mkdirSync`; 413 antes de ler o corpo com `maxBytes + 1 MB` de folga e tamanho real conferido pelo serviço (→ 413); `checkAuth` (aceita `?token=`) em PUT/DELETE/GET; 404 sem leitura/sem áudio; 400 tipo/conversão/multipart; GET `audio/ogg`; `GET /readings` com `audio`; `sendDevotional` e `sendToRecipient` delegam ao `DevotionalSender`. `swagger.json` documenta PUT/GET/DELETE, `?token=`, 400/401/404/413 e o schema `audio` (ver nota) |
| 10 — Infra | PASS | `Dockerfile` `apk add --no-cache ffmpeg`; `nginx.conf` `client_max_body_size 20m` em `location /api/`; compose `AUDIO_DIR=/app/data/audio` (no volume `./data`) e `AUDIO_MAX_UPLOAD_MB=${AUDIO_MAX_UPLOAD_MB:-15}` com descrições x-casaos; `CASAOS.md` com as duas envs |
| 11 — UI | PASS | `readings-page.tsx`: coluna Áudio; "Anexar mp3" com `accept="audio/mpeg,.mp3"`; nome · tamanho, "Ouvir" (Modal com `<audio controls src="/api/readings/:date/audio?token=…">`), "Substituir", "Remover" com `window.confirm`; loading por linha via `variables`; erro em `Alert`; `onSettled` invalida `['readings']`. Upload sobrescreve o `Content-Type` JSON; axios 1.13.6 (`helpers/resolveConfig.js:36-38`) zera o header para `FormData` no browser, então o boundary é o do browser. Lint ui verde |

**Nota sobre o `swagger.json` (passo 9)**: confirmado contra o baseline — `git show 2d1ff3e:apps/api/src/swagger.json` já falha no `JSON.parse` (linha 31, vírgula sobrando após o `delete` de `/api/recipients/{id}`); na working tree o erro é o mesmo, deslocado para a linha 37. Removendo só essa vírgula em memória, o arquivo parseia e traz `/readings/{date}/audio` com `parameters`, `put`, `get` e `delete`. O defeito é anterior e fora de escopo; o que o passo 9 exige (documentar as rotas e o campo `audio`) está feito. **Não bloqueia o PASS.** Fica como dívida: `/api-docs` segue quebrado como já estava.

### Critérios de aceite
- ✅ Anexar áudio a uma data (associar, substituir, remover) — `audio.test.ts` (save/replace/remove) + rotas e UI por inspeção
- ✅ Envio com áudio — `devotional-sender.test.ts` "with audio…" + `devotional.test.ts` `hasAudio` + `whatsapp.test.ts` payload `ptt`
- ✅ Envio sem áudio — `devotional-sender.test.ts` "without audio…" + `devotional.test.ts` igualdade de string com o baseline
- ✅ Borda: não-mp3 ou acima do limite recusado, áudio anterior mantido (FR-002) — `audio.test.ts` (tipo, tamanho, conversão) + 400/413 nas rotas por inspeção
- ✅ Borda: data sem leitura não aceita áudio — `index.ts` `hasReading` → 404 no PUT, por inspeção
- ✅ Borda: substituição, só o mais recente (FR-003) — `audio.test.ts` "replacing swaps the file and the metadata"
- ✅ Borda: áudio falha para um destinatário (FR-010) — `devotional-sender.test.ts` "a failed voice note is logged as a warning…"
- ✅ Borda: registro sem arquivo no disco — `audio.test.ts` readFile → null + warn; `devotional-sender.test.ts` "file is gone"
- ✅ Borda: envio manual por destinatário segue a mesma regra — `devotional-sender.test.ts` "single recipient" + `sendToRecipient` delega ao sender
- ✅ FR-004 remover — `audio.test.ts` remove + `DELETE` por inspeção
- ✅ FR-005 painel mostra quais datas têm áudio — `audio.test.ts` list + `GET /readings` com `audio` e coluna na UI, por inspeção e lint
- ✅ FR-008 persiste entre reinícios — `AUDIO_DIR` dentro do volume `./data` + metadados no SQLite (inspeção)
- ✅ FR-009 autenticação — `checkAuth` nas três rotas de áudio (inspeção)

Itens manuais da seção Verificação (ffmpeg real, WhatsApp, painel ponta a ponta, reinício do container) não executados neste ambiente, como o plano de QA prevê; não contam como FAIL.

### Veredito geral: PASS
11/11 passos PASS, critérios cobertos conforme a matriz, suíte e lints verdes. Dívida anterior: `swagger.json` inválido desde o baseline.
