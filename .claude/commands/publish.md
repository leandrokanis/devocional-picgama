---
description: Publica o devocional finalizado no Notion (página já existente no database Devocional). Os arquivos do devocional são locais e não vão para o git. Execute somente após revisão e aprovação do texto.
---

# Publish

Publica o devocional do dia no Notion. Execute somente quando o texto estiver aprovado.

Os arquivos do devocional (`docs/devocionais/{Pasta}`) são **apenas locais** — não são commitados nem enviados ao git. **Exceção: `docs/devocionais/variety-ledger.md` é commitado e enviado ao git a cada publicação.**

## Fase 1: Leitura do contexto

- Leia `docs/devocionais/CURRENT.md`.
- Extraia **Data** (`YYYY-MM-DD`), **Leitura** e **Pasta**.
- Verifique que `devocional.md` existe na pasta. Se não existir, informe e pare.
- Leia também `estudo.md` e `cosmovisao.md` da pasta — serão publicados no database **Exegeses** (Fase 3).

## Fase 2: Notion — atualizar página existente

A página do dia já existe no database Devocional. Não crie uma nova.

1. **Localizar o database:** use o MCP Notion. Busque pelo database **Devocional** (ou **📖 Devocional**).
2. **Localizar a página do dia:** encontre a entrada correspondente à **Data** do devocional (`YYYY-MM-DD`) e/ou ao título da leitura (ex: `1 Reis 18-19`). Use `notion-search` ou `notion-query-database-view` até identificar o `page_id`.
3. **Substituir o conteúdo:** use `notion-update-page` com:
   - `command: "replace_content"`
   - `page_id`: UUID da página encontrada
   - `new_str`: conteúdo completo de `devocional.md` (título H1, descrição Spotify, introdução de gravação e o roteiro completo)
4. Se a página não for encontrada para aquela data, informe o usuário e não crie uma nova sem autorização explícita.

## Fase 3: Publicar exegese no database Exegeses

Publique o **estudo (Zabatiero)** e a **cosmovisão (CQR)** numa **única página** do database **Exegeses**.

- **Database Exegeses:** página-mãe "Exegese" (`https://www.notion.so/leandroalves/Exegese-2584a446212b4770843b0efd07b6957b`); data source `collection://68bd8b69-e8d1-448f-8bc1-34d51c2ec3c6`.
- **Schema:** título `Texto bíblico`; select `livro` (opções incluem `Salmo`); relação `📖 Pregações` (não preencher).

Passos:
1. **Procurar página existente** com título igual à **Leitura** (ex: `Salmos 30-34`) via `notion-search` no data source. Evite duplicata.
2. **Conteúdo da página** (uma página, duas seções, nesta ordem):
   - `## Estudo — método semio-discursivo (Zabatiero)` + conteúdo integral de `estudo.md` (sem o H1).
   - `## Cosmovisão — Criação-Queda-Redenção` + conteúdo integral de `cosmovisao.md` (sem o H1).
3. **Se existir:** `notion-update-page` com `command: "replace_content"`, `new_str` = o conteúdo acima.
   **Se não existir:** `notion-create-pages` no data source `collection://68bd8b69-e8d1-448f-8bc1-34d51c2ec3c6`, com:
   - propriedade título `Texto bíblico` = a **Leitura**;
   - propriedade `livro` = o nome do livro (ex: `Salmo` para Salmos). Se o livro não estiver nas opções do select, crie a opção.
   - corpo = o conteúdo das duas seções.
4. Confirme sucesso antes de prosseguir.

## Fase 4: Commitar variety-ledger

1. Confirme que as Fases 2 e 3 (Notion) tiveram sucesso. Só prossiga se sim.
2. Commite e envie o `variety-ledger.md` atualizado:
   ```
   git add docs/devocionais/variety-ledger.md
   git commit -m "chore: update variety ledger — {Leitura}"
   git push origin HEAD:main
   ```
   O `variety-ledger.md` **não é apagado** — persiste entre devocionais.

## Fase 5: Limpar estado

1. Apague a pasta local do devocional gerada no processo (`estudo.md`, `cosmovisao.md`, `plano.md`, `devocional.md` e a pasta `{Pasta}`):
   ```
   rm -rf {Pasta}
   ```
2. Reponha `docs/devocionais/CURRENT.md` ao estado vazio:

```
---
# Devocional em andamento

> Arquivo de estado. Atualizado automaticamente pela skill `/study`.
> Lido por todas as skills como fonte de contexto do devocional atual.

- **Data:** —
- **Leitura:** —
- **Pasta:** —
```

## Fase 6: Confirmação

Devolva ao usuário:
- Link da página do devocional no Notion
- Link da página de exegese no database Exegeses
