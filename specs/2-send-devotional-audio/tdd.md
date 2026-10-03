## Plano de QA

baseline_commit 2d1ff3e8b031f5f546496853fad3fe93d83a35fe

01:55  📐 BARRA   AudioService grava, substitui, lê e remove de verdade
       SQLite temporário + migrate deploy + conversor fake: prova o
       Prisma real e a migração sem depender de ffmpeg

01:55  📐 BARRA   envio: texto antes do áudio, por destinatário
       DevotionalSender com WhatsApp fake que registra a ordem das
       chamadas; é a única fronteira observável sem Baileys

01:56  📐 BARRA   rotas, UI, infra e conversor ffmpeg
       inspeção do diff + lint (api e ui); o plan.md tira rotas e UI
       dos testes automatizados, então falta de teste ali não é PARCIAL

01:56  🧬 EXIGE   formatMessage ignora hasAudio (🎧 sempre)  ·  vermelha
       prova que o link some só quando há áudio

01:56  🧬 EXIGE   formatMessage sem flag muda 1 caractere  ·  vermelha
       prova "idêntico ao atual" por igualdade de string, não contains

01:57  🧬 EXIGE   sender envia áudio antes do texto  ·  vermelha
       prova a ordem "texto e, em seguida, o áudio"

01:57  🧬 EXIGE   sender manda áudio mesmo com texto falho  ·  vermelha
       prova o "se ok" da decisão de fluxo

01:57  🧬 EXIGE   falha do áudio lança e para o laço  ·  vermelha
       prova o FR-010: os demais destinatários seguem recebendo

01:57  🧬 EXIGE   sucesso passa a contar áudios  ·  vermelha
       prova que o retorno conta textos entregues

01:57  🧬 EXIGE   hasAudio vindo do registro e não do buffer  ·  vermelha
       arquivo sumido tem de sair com a linha 🎧; se sobreviver, o
       destinatário recebe texto sem link e sem áudio

01:58  🧬 EXIGE   readFile chamado por destinatário  ·  vermelha
       prova "buffer lido uma vez"

01:58  🧬 EXIGE   save sem checagem de tamanho  ·  vermelha
       prova o limite (FR-002)

01:58  🧬 EXIGE   save apaga o .ogg antigo antes de converter  ·  vermelha
       prova que falha de conversão mantém o áudio anterior

01:58  🧬 EXIGE   save não apaga os temporários  ·  vermelha
       prova que AUDIO_DIR termina só com <date>.ogg

01:58  🧬 EXIGE   remove não tolera arquivo ausente  ·  vermelha
       prova o caso "registro sem arquivo" no remove

01:59  ⚠️ LACUNA  validação do :date nas rotas
       o arquivo é <AUDIO_DIR>/<date>.ogg; o plano não fixa regex
       YYYY-MM-DD no path. Sem ela, PUT/GET/DELETE ficam abertos a
       path traversal → passo "Rotas da API" PARCIAL

01:59  ⚠️ LACUNA  WhatsAppService.sendVoiceMessage sem teste decidido
       o plano não diz como provar o payload ptt/mimetype; fica
       inspeção + lint. Teste com sock fake seria bem-vindo

01:59  ⚠️ LACUNA  413 por Content-Length vs. overhead do multipart
       o corpo multipart é maior que o arquivo; comparar
       Content-Length direto com maxBytes recusa um mp3 no limite.
       Exigir folga ou checar o tamanho real do arquivo depois

01:59  ⚠️ LACUNA  FfmpegAudioConverter e ENOENT
       sem ffmpeg na máquina não há teste do conversor real; o risco
       pede log "ffmpeg not found" distinto do 400 de mp3 inválido.
       Sem isso no diff → passo AudioConverter PARCIAL

01:59  ⚠️ LACUNA  verificação manual ponta a ponta
       sem ffmpeg nem WhatsApp aqui, os itens manuais da seção
       Verificação não rodam; ficam registrados como não executados,
       não como FAIL

## Rodada 1 · implementador

02:01  ⚙️ SETUP   yarn install + prisma:generate  ·  baseline 1 passed
       lint api e ui verdes antes de qualquer mudança

02:01  ✅ PASSO 1/11 — Atualizar a spec  ·  +0 testes  ·  suíte 1
       doc: FR-001 com limite configurável (default 15 MB); seção
       Decisões com conversão ogg/opus, link 🎧, envio manual, limite

02:02  🔴 RED    migrations create the devotional_audios table used by
       the client
       migrate deploy num SQLite tmp + client gerado gravam e leem um
       DevotionalAudio; schema e SQL divergentes quebram aqui
       plan.md Passo 2 (modelo e migração)
       TypeError: Cannot read properties of undefined (reading 'create')

02:02  🟢 GREEN  migrations create the devotional_audios table used by
       the client  ·  1 passed
       prisma migrate diff (migrations → schema): No difference detected

02:02  ✅ PASSO 2/11 — Modelo e migração  ·  +1 teste  ·  suíte 2
       tipos shared DevotionalAudio e audio em DevotionalReading; lint
       api e ui verdes

02:03  🔴 RED    converts the input to a mono 32k opus voice note at
       the output path
       ffmpeg falso (script) grava os argumentos recebidos no output;
       prova -c:a libopus -b:a 32k -ac 1 -ar 48000 -application voip
       plan.md Decisão "Parâmetros opus"
       Error: Failed to load url ./audio-converter.js

02:03  🟢 GREEN  converts the input to a mono 32k opus voice note at
       the output path  ·  1 passed

02:03  🔴 RED    rejects with the ffmpeg stderr when it exits with a
       non-zero code
       mp3 inválido: ffmpeg sai com código ≠ 0 e o erro carrega o stderr
       plan.md Passo 3 (rejeita em exit ≠ 0 com o stderr no erro)
       AssertionError: promise resolved "undefined" instead of rejecting

02:03  🟢 GREEN  rejects with the ffmpeg stderr when it exits with a
       non-zero code  ·  2 passed

02:03  🔴 RED    rejects with "ffmpeg not found" when the binary is
       missing
       spawn com ENOENT vira erro explícito, distinto de mp3 inválido
       plan.md Riscos ("ffmpeg ausente no ambiente")
       Error: Test timed out in 5000ms. (Unhandled Error: spawn ENOENT)

02:03  🟢 GREEN  rejects with "ffmpeg not found" when the binary is
       missing  ·  3 passed

02:03  ✅ PASSO 3/11 — AudioConverter  ·  +3 testes  ·  suíte 5
       ffmpeg real não é usado: o binário é injetável e os testes usam
       scripts falsos; lint verde

02:04  🔴 RED    attaching stores the converted voice note as
       <date>.ogg and records its metadata
       anexar mp3 cria <AUDIO_DIR>/<date>.ogg convertido e o registro
       Cenário "Anexar áudio a uma data"; FR-001
       Error: Failed to load url ./audio.js

02:04  🟢 GREEN  attaching stores the converted voice note as
       <date>.ogg and records its metadata  ·  2 passed

02:04  🟢 GREEN  replacing swaps the file and the metadata, leaving
       only <date>.ogg in AUDIO_DIR  ·  3 passed
       verde sem RED: rename sobre <date>.ogg + upsert já cobriam;
       fica como guarda de FR-003 (um só .ogg por data)

02:04  🔴 RED    rejects a file that is neither .mp3 nor audio/mpeg and
       keeps the previous audio
       upload .txt/text/plain é recusado; registro e bytes anteriores
       continuam iguais
       FR-002; Decisão "Validação de mp3"
       AssertionError: promise resolved "{ originalName: 'notes.txt', …(2)
       }" instead of rejecting

02:05  🟢 GREEN  rejects a file that is neither .mp3 nor audio/mpeg and
       keeps the previous audio  ·  4 passed

02:05  🟢 GREEN  accepts an upload identified as mp3 by extension or
       by mime (2 casos)  ·  6 passed
       verde sem RED: o "ou" do isMp3 já existia; fica como guarda
       contra exigir os dois

02:05  🔴 RED    rejects a file above the size limit and keeps the
       previous audio
       maxBytes + 1 é recusado como too_large; anterior intacto
       FR-002; Decisão "Limite de tamanho" (tamanho real conferido)
       AssertionError: promise resolved "{ originalName: 'devocional.mp3',
       …(2) }" instead of rejecting

02:05  🟢 GREEN  rejects a file above the size limit and keeps the
       previous audio  ·  7 passed

02:05  🟢 GREEN  accepts a file exactly at the size limit  ·  8 passed
       verde sem RED: guarda contra off-by-one (>= no lugar de >)

02:05  🔴 RED    a failed conversion is rejected, keeps the previous
       audio and leaves no temporary files
       conversor falha → conversion_failed; <date>.ogg antigo e registro
       intactos; AUDIO_DIR só com <date>.ogg
       FR-002; Decisão "Validação de mp3"; plan.md Passo 4 (temporários)
       AssertionError: expected Error: ffmpeg exited with code 1: Invalid…
       to match object { reason: 'conversion_failed' }

02:06  🟢 GREEN  a failed conversion is rejected, keeps the previous
       audio and leaves no temporary files  ·  9 passed

02:06  🔴 RED    when the database write fails on a replacement, the
       previous file is restored  (+ first attach: no file left)
       trigger SQLite faz o upsert falhar; o arquivo volta ao anterior,
       ou some se não havia anterior
       plan.md Passo 4 ("se o upsert falhar, desfaz o arquivo")
       1ª execução: asserção toThrow('db down') errada (Prisma embrulha a
       mensagem) → trocada por toThrow(); falha certa:
       AssertionError: expected { file: 'ogg:second', …(1) } to deeply
       equal { file: 'ogg:first', …(1) }
       AssertionError: expected [ '2026-01-02.ogg' ] to deeply equal []

02:08  🟢 GREEN  when the database write fails on a replacement /
       first attach  ·  11 passed
       backup do .ogg anterior antes do rename; upsert falho restaura

02:08  🧬 MUTAÇÃO save sem checagem de tamanho  ·  1 vermelho
02:08  🧬 MUTAÇÃO save apaga o .ogg antigo antes de converter  ·  2
       vermelhos
02:08  🧬 MUTAÇÃO save não apaga os temporários  ·  4 vermelhos
       (arquivo restaurado após cada mutação)

02:08  🔧 REFACTOR test-db migra um template uma vez e copia por
       teste  ·  11 passed  ·  1,2 s em vez de ~11 s

02:08  ✅ PASSO 4/11 — AudioService.save  ·  +10 testes  ·  suíte 15

02:08  🟢 GREEN  AudioService.get returns null for a date without audio
       ·  12 passed
       verde sem RED: findUnique já devolvia null; guarda do contrato

02:08  🔴 RED    AudioService.list maps each date with audio to its
       metadata
       a listagem do painel recebe data → {originalName, sizeBytes,
       updatedAt} numa consulta
       FR-005; Decisão "Listagem e preview"
       TypeError: service.list is not a function

02:08  🟢 GREEN  AudioService.list maps each date with audio to its
       metadata  ·  13 passed

02:08  🔴 RED    AudioService.remove deletes the record and the file
       remover apaga o registro e <date>.ogg
       FR-004
       TypeError: service.remove is not a function

02:08  🟢 GREEN  AudioService.remove deletes the record and the file
       ·  14 passed

02:08  🟢 GREEN  AudioService.remove returns false when the date has no
       audio  ·  15 passed
       verde sem RED: o findUnique → false entrou no GREEN anterior; o
       teste fixa o contrato que a rota usa para o 404

02:08  🔴 RED    AudioService.remove still deletes the record when the
       file is already gone
       registro sem arquivo no disco: remove não pode quebrar
       plan.md Passo 5 ("tolerando arquivo ausente")
       Error: ENOENT: no such file or directory, unlink
       '/tmp/devocional-db-khqOf6/audio/2026-01-02.ogg'

02:08  🟢 GREEN  AudioService.remove still deletes the record when the
       file is already gone  ·  16 passed

02:09  🔴 RED    AudioService.readFile returns the stored voice note
       bytes
       o envio e a rota GET leem o .ogg da data
       FR-006; Decisão "Fluxo de envio" (buffer lido uma vez)
       TypeError: service.readFile is not a function

02:09  🟢 GREEN  AudioService.readFile returns the stored voice note
       bytes  ·  17 passed

02:09  🟢 GREEN  AudioService.readFile returns null for a date without
       audio  ·  18 passed
       verde sem RED: findUnique → null já existia

02:09  🔴 RED    AudioService.readFile returns null and logs a warning
       when the record exists but the file is gone
       arquivo sumido do disco: o envio cai para "só texto" com log
       spec, borda "arquivo registrado mas sumiu"; plan.md Passo 5
       Error: ENOENT: no such file or directory, open
       '/tmp/devocional-db-GfE8ya/audio/2026-01-02.ogg'

02:09  🟢 GREEN  AudioService.readFile returns null and logs a warning
       when the record exists but the file is gone  ·  19 passed

02:09  🧬 MUTAÇÃO remove sem tolerar ENOENT  ·  1 vermelho
02:09  🧬 MUTAÇÃO readFile lança em vez de devolver null  ·  1
       vermelho  (arquivo restaurado após cada mutação)

02:09  🔧 REFACTOR remove usa rm({ force }); findRecord extraído
       ·  19 passed

02:09  ✅ PASSO 5/11 — AudioService.get/list/remove/readFile  ·  +8
       testes  ·  suíte 23

02:10  🟢 GREEN  formatMessage with no options / hasAudio false keeps
       today's exact text, with the 🎧 line  ·  3 passed
       verde sem RED, de propósito: trava a saída do baseline por
       igualdade de string antes de mexer (Cenário "Envio sem áudio")

02:10  🔴 RED    formatMessage with hasAudio omits the 🎧 line
       com áudio na data, o texto sai sem a linha do link fixo
       Decisão "Link fixo 🎧"; Cenário "Envio com áudio"
       AssertionError: expected '📖 Leitura de hoje - 02/01/2026\n\nGê…'
       to be '📖 Leitura de hoje - 02/01/2026\n\nGê…' // Object.is

02:10  🟢 GREEN  formatMessage with hasAudio omits the 🎧 line  ·  4
       passed

02:10  🧬 MUTAÇÃO formatMessage ignora hasAudio  ·  1 vermelho
02:10  🧬 MUTAÇÃO saída sem flag com 1 caractere trocado (áudio →
       audio)  ·  2 vermelhos  (arquivo restaurado)

02:10  ✅ PASSO 6/11 — formatMessage com hasAudio  ·  +3 testes  ·
       suíte 26

02:10  🔴 RED    sends the buffer as an ogg/opus voice note (ptt)
       socket Baileys falso registra o payload { audio, mimetype
       'audio/ogg; codecs=opus', ptt: true } para o chatId aparado
       FR-006; plan.md Passo 7
       TypeError: service.sendVoiceMessage is not a function

02:11  🟢 GREEN  sends the buffer as an ogg/opus voice note (ptt)  ·  1
       passed

02:11  🟢 GREEN  returns false without sending when WhatsApp is not
       connected / returns false instead of throwing when the socket
       fails  ·  3 passed
       verde sem RED: as guardas entraram junto no GREEN anterior
       (espelho do sendMessage); os testes fixam o contrato

02:11  🧬 MUTAÇÃO exceção do socket vaza  ·  1 vermelho
02:11  🧬 MUTAÇÃO mimetype audio/mpeg no payload  ·  1 vermelho
       (arquivo restaurado)

02:11  🔧 REFACTOR sendMessage e sendVoiceMessage usam deliver()
       privado  ·  3 passed  ·  lint verde

02:11  ✅ PASSO 7/11 — WhatsAppService.sendVoiceMessage  ·  +3
       testes  ·  suíte 29

02:11  🔴 RED    with audio, each recipient gets the text without the
       🎧 line and then the voice note
       ordem por destinatário: texto (sem 🎧) → nota de voz; WhatsApp
       falso registra a sequência
       Cenário "Envio com áudio"; FR-006
       Error: Failed to load url ./devotional-sender.js

02:12  🟢 GREEN  with audio, each recipient gets the text without the
       🎧 line and then the voice note  ·  1 passed

02:12  🟢 GREEN  without audio → only text with 🎧 / registered but
       file gone → only text with 🎧  ·  3 passed
       verde sem RED: hasAudio já vinha do buffer lido; ficam como
       guarda (o fake de "arquivo sumido" tem get() com registro, então
       derivar hasAudio do registro quebra este teste)

02:12  🔴 RED    a recipient whose text fails gets no voice note, and
       the others still receive both
       nota de voz só depois de texto entregue; o laço segue
       Decisão "Fluxo de envio" ("e se ok, sendVoiceMessage")
       AssertionError: expected { sent: true, deliveries: [ …(3) ] } to
       deeply equal { sent: true, deliveries: [ …(2) ] }

02:12  🟢 GREEN  a recipient whose text fails gets no voice note, and
       the others still receive both  ·  4 passed

02:12  🔴 RED    a failed voice note is logged as a warning, the text
       is not resent and the others still receive both
       falha parcial do áudio: logger.warn com o chatId; sem reenvio do
       texto; o próximo destinatário recebe texto + voz
       FR-010; spec, borda "texto entregue, áudio falha"
       AssertionError: expected { sent: true, …(2) } to deeply equal
       { sent: true, …(2) }  (warned: false)

02:12  🟢 GREEN  a failed voice note is logged as a warning, the text
       is not resent and the others still receive both  ·  5 passed

02:13  🟢 GREEN  success counts texts (voices all fail → true; texts
       all fail → false) / single recipient same path / reads the audio
       once  ·  9 passed
       verde sem RED: comportamentos já implementados nas fatias
       anteriores; provados pelas mutações abaixo

02:13  🧬 MUTAÇÃO áudio antes do texto  ·  4 vermelhos
02:13  🧬 MUTAÇÃO áudio mesmo com texto falho  ·  1 vermelho
02:13  🧬 MUTAÇÃO falha do áudio lança e para o laço  ·  2 vermelhos
02:13  🧬 MUTAÇÃO sucesso conta áudios (não textos)  ·  3 vermelhos
       (a variante "texto + áudio somados" é equivalente para o retorno
       booleano e sobrevive; não muda o contrato)
02:13  🧬 MUTAÇÃO hasAudio vindo do registro (get) e não do buffer
       ·  1 vermelho
02:13  🧬 MUTAÇÃO readFile por destinatário  ·  1 vermelho
       (arquivo restaurado após cada mutação)

02:13  ✅ PASSO 8/11 — DevotionalSender  ·  +9 testes  ·  suíte 38
       a ligação do DevotionalBot ao sender entra no Passo 9 junto com a
       criação do AudioService em index.ts

02:15  🛠️ ROTAS  index.ts: AudioService (AUDIO_DIR default
       <repo>/data/audio por __dirname + mkdir -p; AUDIO_MAX_UPLOAD_MB
       default 15); PUT/DELETE/GET /readings/:date/audio com :date
       restrito a \d{4}-\d{2}-\d{2} no path; 413 cedo por Content-Length
       > maxBytes + 1 MB (folga do multipart), antes de ler o corpo;
       tamanho real conferido pelo AudioService; GET /readings com audio;
       DevotionalBot delega ao DevotionalSender (lista e destinatário)
       verificação pelo plano: inspeção + lint (verde). Fumaça manual
       local com ffmpeg falso no PATH: 401 sem token; 200 anexar; 400
       conversão; 400 .txt; 413 tamanho real (2,2 MB > 2 MB); 413 cedo
       (3,5 MB); 404 data sem leitura; 404 em :date fora do formato e
       com ../; GET ?token= 200 audio/ogg; DELETE 200 → 404 → GET 404

02:15  ⚠️ NOTA   swagger.json já era JSON inválido no baseline
       (vírgula sobrando após "delete" de /api/recipients/{id}); fora de
       escopo, não corrigido. As entradas novas parseiam isoladas

02:15  ✅ PASSO 9/11 — Rotas da API  ·  +0 testes  ·  suíte 38

02:15  🛠️ INFRA  Dockerfile: RUN apk add --no-cache ffmpeg; nginx
       location /api/: client_max_body_size 20m; compose: AUDIO_DIR=
       /app/data/audio (dentro do volume ./data) e AUDIO_MAX_UPLOAD_MB=
       ${AUDIO_MAX_UPLOAD_MB:-15} com descrições x-casaos; CASAOS.md com
       as duas envs e a pasta de áudios em Dados persistentes
       verificação pelo plano: inspeção; docker compose config -q ok

02:15  ✅ PASSO 10/11 — Infra  ·  +0 testes  ·  suíte 38

02:16  🛠️ UI     readings-page.tsx: coluna Áudio; sem áudio →
       FileButton "Anexar mp3" (accept audio/mpeg,.mp3); com áudio →
       nome · tamanho, "Ouvir" (Modal com <audio controls src=/api/
       readings/:date/audio?token=…&v=updatedAt>), "Substituir"
       (FileButton) e "Remover" (window.confirm); upload FormData com
       Content-Type sobrescrito (multipart, o axios 1.13 deixa o browser
       pôr o boundary); loading por linha via variables da mutation;
       erro em Alert; onSettled invalida ['readings']
       verificação pelo plano: inspeção + lint ui (verde)

02:16  ✅ PASSO 11/11 — UI  ·  +0 testes  ·  suíte 38

02:16  🏁 FINAL  api test 38 passed (5 arquivos)  ·  lint api e ui
       verdes  ·  tsc -p tsconfig.build.json ok  ·  migrate diff sem
       diferença. Itens manuais da Verificação (ffmpeg real, WhatsApp)
       não executados aqui

02:16  🔧 REFACTOR test-db apaga o template no afterAll do vitest
       (o hook de process exit não roda nos workers e deixava 19 dirs
       em /tmp)  ·  38 passed  ·  nenhum resíduo em /tmp

## Rodada 1 · QA

02:17  📊 SUÍTE  api 38 passed  ·  0 failed (5 arquivos)
       lint api (tsc --noEmit) e lint ui (tsc --noEmit) verdes

02:18  🔎 QA     passo 1/11 — Atualizar a spec  ·  ✅ PASS
       FR-001 com AUDIO_MAX_UPLOAD_MB default 15 MB; seção Decisões
       com conversão opus, link 🎧 e envio manual

02:18  🔎 QA     passo 2/11 — Modelo e migração  ·  ✅ PASS
       model e migração batem; teste de schema roda migrate deploy;
       tipos shared consumidos pela UI com lint verde

02:18  🧬 MUTAÇÕES · AudioConverter  ·  3 de 3 mortas
       ☠️  ENOENT tratado como erro genérico               1 teste
       ☠️  exit ≠ 0 resolve                                1 teste
       ☠️  bitrate 32k → 64k                               1 teste

02:18  🔎 QA     passo 3/11 — AudioConverter  ·  ✅ PASS
       spawn com os parâmetros decididos; stderr no erro; ENOENT →
       logger.error + erro "ffmpeg not found", com teste

02:18  🧬 MUTAÇÕES · AudioService.save  ·  5 de 5 mortas
       ☠️  sem checagem de tamanho                         1 teste
       ☠️  apaga o .ogg antigo antes de converter          2 testes
       ☠️  não apaga temporários                           5 testes
       ☠️  upsert falho não desfaz o arquivo               2 testes
       ☠️  não-mp3 aceito                                  1 teste

02:18  🔎 QA     passo 4/11 — AudioService.save  ·  ✅ PASS
       as três mutações exigidas vermelhas; rollback do upsert coberto
       por trigger SQLite real

02:18  🧬 MUTAÇÕES · AudioService.get/list/remove/readFile  ·  3 de 4
       ☠️  remove sem tolerar ENOENT                       1 teste
       ☠️  readFile lança em vez de null                   1 teste
       ☠️  readFile sem logger.warn                        1 teste
       🚨  remove apaga arquivo antes do registro  SOBREVIVEU — não
           exigida pela matriz; a ordem só importa se o delete do
           Prisma falhar depois do rm. Observação, não reabre

02:18  🔎 QA     passo 5/11 — get/list/remove/readFile  ·  ✅ PASS
       mutações exigidas vermelhas; um caso por comportamento

02:18  🧬 MUTAÇÕES · formatMessage  ·  3 de 3 mortas
       ☠️  ignora hasAudio                                 1 teste
       ☠️  um caractere da linha 🎧 sem flag               2 testes
       ☠️  um caractere do texto base                      3 testes

02:18  🔎 QA     passo 6/11 — formatMessage com hasAudio  ·  ✅ PASS
       igualdade de string com o formato do baseline (toBe)

02:19  🧬 MUTAÇÕES · sendVoiceMessage  ·  2 de 2 mortas
       ☠️  ptt: false                                      1 teste
       ☠️  exceção do socket vaza                          1 teste

02:19  🔎 QA     passo 7/11 — WhatsAppService.sendVoiceMessage  ·  ✅ PASS
       payload exato e false desconectado/em erro, com sock fake

02:19  🧬 MUTAÇÕES · DevotionalSender  ·  9 de 9 mortas
       ☠️  áudio antes do texto                            4 testes
       ☠️  áudio com texto falho                           1 teste
       ☠️  falha do áudio interrompe o laço (break)        1 teste
       ☠️  falha do áudio lança                            2 testes
       ☠️  sucesso conta áudios                            3 testes
       ☠️  sem logger.warn na falha do áudio               1 teste
       ☠️  readFile por destinatário                       1 teste
       ☠️  hasAudio sempre false                           4 testes
       ☠️  hasAudio sempre true (ignora o buffer)          2 testes

02:19  🔎 QA     passo 8/11 — DevotionalSender  ·  ✅ PASS
       os seis cenários da matriz cobertos; mutações exigidas vermelhas

02:20  🔎 QA     passo 9/11 — Rotas da API  ·  ✅ PASS
       :date em \d{4}-\d{2}-\d{2}; 413 cedo com folga de 1 MB e real
       pelo serviço; auth nas três; bot delega ao sender. swagger.json
       inválido já no baseline (mesma vírgula); removida só ela em
       memória, o arquivo parseia com as rotas novas. Não bloqueia

02:20  🔎 QA     passo 10/11 — Infra  ·  ✅ PASS
       ffmpeg no Dockerfile, 20m no nginx, envs no compose e CASAOS

02:20  🔎 QA     passo 11/11 — UI  ·  ✅ PASS
       Content-Type sobrescrito; axios 1.13.6 zera o header para
       FormData no browser (resolveConfig) e o boundary sai certo

02:20  🏁 VEREDITO  PASS  ·  11/11  ·  critérios cobertos pela matriz
       itens manuais da Verificação não executados (sem ffmpeg/WhatsApp)
