---
description: Publica o devocional finalizado: commit e push do arquivo e envio para a página já existente no database Devocional do Notion. Execute somente após revisão e aprovação do texto.
---

# Publish

Publica o devocional do dia. Execute somente quando o texto estiver aprovado — não há volta fácil depois do push.

## Fase 1: Leitura do contexto

- Leia `docs/devocionais/CURRENT.md`.
- Extraia **Data** (`YYYY-MM-DD`), **Leitura** e **Pasta**.
- Verifique que `devocional.md` existe na pasta. Se não existir, informe e pare.

## Fase 2: Git — commit e push

1. Stage todos os arquivos da pasta do devocional que estejam não rastreados ou modificados:
   ```
   git add {Pasta}
   ```
2. Commit com mensagem no formato:
   ```
   docs: devocional {YYYY-MM-DD} - {Leitura}
   ```
3. Push para o remote.
4. Confirme que o push foi bem-sucedido antes de continuar.

## Fase 3: Notion — atualizar página existente

A página do dia já existe no database Devocional. Não crie uma nova.

1. **Localizar o database:** use o MCP Notion. Busque pelo database **Devocional** (ou **📖 Devocional**).
2. **Localizar a página do dia:** encontre a entrada correspondente à **Data** do devocional (`YYYY-MM-DD`) e/ou ao título da leitura (ex: `1 Reis 18-19`). Use `notion-search` ou `notion-query-database-view` até identificar o `page_id`.
3. **Substituir o conteúdo:** use `notion-update-page` com:
   - `command: "replace_content"`
   - `page_id`: UUID da página encontrada
   - `new_str`: conteúdo completo de `devocional.md` (título H1, descrição Spotify, introdução de gravação, oito parágrafos)
4. Se a página não for encontrada para aquela data, informe o usuário e não crie uma nova sem autorização explícita.

## Fase 4: Limpar estado

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

## Fase 5: Confirmação

Devolva ao usuário:
- Confirmação do commit (hash curto)
- Link da página Notion atualizada
