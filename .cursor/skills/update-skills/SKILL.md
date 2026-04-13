---
name: update-skills
description: >-
  Atualiza skills e documentação de apoio do repositório com base em feedback do usuário
  (novas instruções, o que não funcionou, exemplos a seguir). Use quando o usuário pedir
  para atualizar uma skill, mudar regras do agente para devocionais, ajustar SKILL.md,
  examples.md, docs/RULES.md ou rules em .cursor/rules ligadas a esse fluxo.
---

# Update Skills

Aplica mudanças mínimas e precisas nas **skills** e na **documentação necessária** para refletir o que o usuário pediu.

## Entrada (parcial é válida)

O usuário pode enviar qualquer combinação:

- Novas instruções ou regras
- O que não gostou (anti-padrões, trechos a remover)
- Exemplo de texto ou formato a ser seguido como referência

Se **qual skill** ou **quais arquivos** alterar estiver ambíguo, pergunte de forma objetiva antes de editar.

## Escopo permitido

Editar apenas o necessário, por exemplo:

- `.cursor/skills/**/SKILL.md`
- `.cursor/skills/**/*.md` (ex.: `examples.md`)
- `docs/RULES.md` quando as regras de escrita do devocional precisarem alinhar à skill
- `.cursor/rules/*.mdc` quando a regra Cursor dever refletir a mesma política

Prefira **diff pequeno**: só o que o feedback exige.

## Escopo proibido (crítico)

- **Não** editar, criar nem apagar arquivos em `docs/devocionais/**` neste fluxo.
- Devocionais são conteúdo editorial final; atualização de skill **não** os reescreve.

Se o usuário misturar pedido de skill com pedido de reescrever um devocional, trate como **duas tarefas**: conclua só a parte de skills/documentação aqui; para o devocional, confirme se deseja outra ação explícita.

## Fluxo

1. Identificar skill(s) e arquivos alvo a partir da mensagem.
2. Extrair requisitos: adicionar, remover, reformular; incorporar exemplo bom como régua escrita na skill ou em `docs/RULES.md`.
3. Abrir os arquivos atuais, aplicar alterações cirúrgicas, manter tom e estrutura já usados no projeto.
4. Se um exemplo do usuário for longo, coloque o **padrão** na skill ou em `examples.md`; não precisa colar exemplos inteiros se um parágrafo de regra basta.
5. Conferir que **nenhum** path sob `docs/devocionais/` foi modificado.

## Checklist antes de encerrar

- [ ] Mudanças restritas a skills + documentação de apoio necessária
- [ ] Nenhum arquivo em `docs/devocionais/` alterado
- [ ] Descrição em YAML da skill afetada continua útil para descoberta (o quê + quando), se tiver sido editada
- [ ] Referências entre arquivos (paths) continuam corretas após renomear ou mover trechos
