---
description: Executa o fluxo completo de criação do devocional: estudo → plano → escrita → publicação. Pausa para revisão humana após o plano e após a escrita. Use com uma data ou referência bíblica.
---

# Devocional

Orquestra o fluxo completo em quatro etapas, com duas pausas para revisão humana.

```
/study  →  [revisão opcional]  →  /plan  →  [revisão obrigatória]  →  /write  →  [revisão obrigatória]  →  /publish
```

## Fase 1: Entrada

- Receba a data ou referência bíblica do usuário (ex: `25/04`, `2026-04-25`, `2 Reis 18-19`).
- Se não fornecida, leia `docs/devocionais/CURRENT.md`. Se vazio, peça ao usuário.

---

## Fase 2: Estudo

Execute integralmente o comando `/study` para a data ou referência recebida.

Ao concluir, pergunte ao usuário:
> **Estudo concluído. Deseja revisar antes de continuar para o plano, ou posso prosseguir?**

- Se o usuário quiser revisar: aguarde confirmação explícita para continuar.
- Se o usuário mandar prosseguir: siga imediatamente.

---

## Fase 3: Plano

Execute integralmente o comando `/plan`.

Ao concluir, **pause obrigatoriamente** e pergunte:
> **Plano pronto. Revise as decisões acima — via cristológica, cenário, gancho e ideia central — e me diga se aprova ou quer ajustar algo antes de escrever.**

Aguarde resposta explícita do usuário. Só prossiga quando ele aprovar. Se houver ajustes, aplique-os no `plano.md` e mostre o trecho corrigido antes de continuar.

---

## Fase 4: Escrita

Execute integralmente o comando `/write`.

Ao concluir, **pause obrigatoriamente** e pergunte:
> **Devocional escrito. Leia o texto acima e me diga se aprova ou quer ajustar algo antes de publicar.**

Aguarde resposta explícita do usuário. Só prossiga quando ele aprovar. Se houver ajustes, aplique-os no `devocional.md` e mostre o trecho corrigido antes de continuar.

---

## Fase 5: Publicação

Execute integralmente o comando `/publish`.

Ao concluir, confirme ao usuário com o hash do commit e o link da página Notion.
