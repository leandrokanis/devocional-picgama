---
description: Publica o devocional finalizado no Notion (página já existente no database Devocional). Os arquivos do devocional são locais e não vão para o git. Execute somente após revisão e aprovação do texto.
---

# Publish

Publica o devocional do dia no Notion. Execute somente quando o texto estiver aprovado.

Os arquivos do devocional (`docs/devocionais/{Pasta}`) são **apenas locais** — não são commitados nem enviados ao git. Esta skill não faz commit nem push.

## Fase 1: Leitura do contexto

- Leia `docs/devocionais/CURRENT.md`.
- Extraia **Data** (`YYYY-MM-DD`), **Leitura** e **Pasta**.
- Verifique que `devocional.md` existe na pasta. Se não existir, informe e pare.

## Fase 2: Notion — atualizar página existente

A página do dia já existe no database Devocional. Não crie uma nova.

1. **Localizar o database:** use o MCP Notion. Busque pelo database **Devocional** (ou **📖 Devocional**).
2. **Localizar a página do dia:** encontre a entrada correspondente à **Data** do devocional (`YYYY-MM-DD`) e/ou ao título da leitura (ex: `1 Reis 18-19`). Use `notion-search` ou `notion-query-database-view` até identificar o `page_id`.
3. **Substituir o conteúdo:** use `notion-update-page` com:
   - `command: "replace_content"`
   - `page_id`: UUID da página encontrada
   - `new_str`: conteúdo completo de `devocional.md` (título H1, descrição Spotify, introdução de gravação, oito parágrafos)
4. Se a página não for encontrada para aquela data, informe o usuário e não crie uma nova sem autorização explícita.

## Fase 3: Limpar estado

Reponha `docs/devocionais/CURRENT.md` ao estado vazio:

```
---
# Devocional em andamento

> Arquivo de estado. Atualizado automaticamente pela skill `/study`.
> Lido por todas as skills como fonte de contexto do devocional atual.

- **Data:** —
- **Leitura:** —
- **Pasta:** —
```

## Fase 4: Confirmação

Devolva ao usuário:
- Link da página Notion atualizada
