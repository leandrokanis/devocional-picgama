---
description: Executa o fluxo completo de criação do devocional: estudo → plano → escrita → publicação. Roda até o final sem pausas. Se nenhuma data for passada, usa o dia seguinte ao último devocional registrado no variety-ledger.
model: claude-fable-5
---

# Devocional

Orquestra o fluxo completo em quatro etapas, sem pausas para revisão.

```
git pull  →  /study  →  /plan  →  /write  →  /publish
```

## Fase 0: Atualização do repositório

Antes de qualquer coisa, execute:

```
git pull origin main
```

Se houver conflitos, informe o usuário e pare.

---

## Fase 1: Entrada

- Se uma data ou referência bíblica foi passada como argumento (ex: `25/04`, `2026-04-25`, `2 Reis 18-19`), use-a.
- Se **nenhuma data** foi passada:
  - Leia `docs/devocionais/variety-ledger.md`.
  - Identifique a data mais recente listada (formato `YYYY-MM-DD` nos cabeçalhos `## YYYY-MM-DD — ...`). O arquivo está em ordem cronológica crescente — a última entrada é a mais recente.
  - Some um dia a essa data. Essa é a data do devocional a ser criado.
  - Confirme ao usuário: `Nenhuma data informada. Usando YYYY-MM-DD (dia seguinte ao último registrado).`

---

## Fase 2: Estudo

Execute integralmente o comando `/study` para a data determinada na Fase 1.

Prossiga imediatamente para a Fase 3 ao concluir. **Não faça perguntas.**

---

## Fase 3: Plano

Execute integralmente o comando `/plan`.

Prossiga imediatamente para a Fase 4 ao concluir. **Não faça perguntas.**

---

## Fase 4: Escrita

Execute integralmente o comando `/write`.

Prossiga imediatamente para a Fase 5 ao concluir. **Não faça perguntas.**

---

## Fase 5: Publicação

Execute integralmente o comando `/publish`.

Ao concluir, confirme ao usuário com o hash do commit e o link da página Notion.
