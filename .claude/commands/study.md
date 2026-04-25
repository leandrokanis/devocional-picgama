---
description: Realiza estudo exegético-teológico de um texto bíblico. Use com uma data (ex: 25/04, 2026-04-25) ou referência direta (ex: 2 Reis 18-19). Primeiro passo do fluxo estudo → plano → escrita → publicação.
---

# Study

Realize uma análise exegética-teológica estruturada de um texto bíblico.

## Fase 1: Entrada & Localização

- Receba a data ou referência bíblica do usuário (ex: `25/04`, `2026-04-25`, `2 Reis 18-19`).
- Se for uma data, leia `data/readings-2026.json` e localize o campo `reading` da entrada correspondente.
- Se for uma referência direta, use-a como texto base.
- Se não encontrar, informe e pare.

## Fase 2: Leitura de referência teológica

Antes de escrever, leia:

- [docs/theology/greidanus-vias-cristologicas.md](docs/theology/greidanus-vias-cristologicas.md)
- [docs/theology/pactualismo-progressivo.md](docs/theology/pactualismo-progressivo.md)

## Fase 3: Análise (saída estruturada)

Produza o estudo na seguinte estrutura, preenchendo cada campo com precisão acadêmica e linguagem técnica. Este documento é para uso interno do escritor — não é o devocional final.

---

### Contexto Histórico-Literário

- **Autor / público-alvo:** [Se conhecido, indique. Caso contrário: "desconhecido".]
- **Gênero:** [Narrativa, poesia, profecia, lei, epístola, apocalíptico etc.]
- **Situação histórica:** [Onde e quando ocorre. Qual o problema ou tensão em cena.]
- **Referências cruzadas no NT:** [Liste SOMENTE referências explícitas (citação direta ou alusão identificável) desse texto no Novo Testamento. Se nenhuma, escreva "Nenhuma identificada".]

---

### Criação — "Como deveria ser"

- **Sinais de ordem, bondade, vocação ou presença de Deus:** [Palavras, imagens ou ações do texto que retratam o design original de Deus.]
- **Ideia central:** [1-2 frases descrevendo esse estado ideal conforme o texto.]

---

### Queda — "O que deu errado"

- **Distorções, rebelião, sofrimento ou juízo:** [Verbos ou cenas que revelam pecado, caos ou ruptura.]
- **Consequências:** [1-2 frases sobre o impacto negativo observado no texto.]

---

### Redenção — "Como Deus intervém"

- **Ações, promessas ou figuras redentoras:** [Termos de salvação, aliança, libertação ou restauração presentes no texto.]
- **Considerações cristológicas:** [Liste brevemente as possíveis associações do texto a Jesus. Indique quais vias de Greidanus são aplicáveis — use os nomes exatos do arquivo de referência — e aponte a via de maior prioridade segundo a hierarquia: Referências do NT > Progressão histórico-redentiva > Promessa e cumprimento > Tipologia > Contraste > Analogia > Temas longitudinais.]

---

### Síntese C-Q-R

- **Criação:** [Resuma a intenção original de Deus no texto em uma frase.]
- **Queda:** [Resuma o problema apresentado em uma frase.]
- **Redenção:** [Resuma a solução ou esperança oferecida em uma frase.]

---

### Temas de aplicação

[Liste os temas tratados no texto que podem servir de aplicação prática para o ouvinte. Seja específico — evite abstrações. Cada tema em um item.]

---

## Fase 4: Validação interna

Antes de liberar, verifique silenciosamente:

- [ ] Todas as seções preenchidas (sem campos em branco além dos justificados).
- [ ] Referências cruzadas NT: apenas explícitas, nenhuma especulativa.
- [ ] Considerações cristológicas: vias de Greidanus nomeadas corretamente e hierarquia indicada.
- [ ] Síntese C-Q-R: exatamente 3 frases (uma por eixo).
- [ ] Temas de aplicação: pelo menos 2 itens concretos.

## Fase 5: Saída

- Imprima o estudo completo com os cabeçalhos conforme a estrutura acima.
- Crie a pasta (se não existir) e salve o arquivo:
  - Pasta: `docs/devocionais/{YYYY-MM-DD}-{livro-lower}-{capitulos}/`
  - Arquivo: `estudo.md` dentro dessa pasta
  - Livro: minúsculo, sem acentos (`1-reis`, `genesis`, `juizes`).
  - Capítulos: separados por hífen (`18-19`).
  - Exemplo: `docs/devocionais/2026-04-25-2-reis-18-19/estudo.md`
- **Atualize `docs/devocionais/CURRENT.md`** com os dados do devocional atual:
  ```
  ---
  # Devocional em andamento

  > Arquivo de estado. Atualizado automaticamente pela skill `/study`.
  > Lido por todas as skills como fonte de contexto do devocional atual.

  - **Data:** {YYYY-MM-DD}
  - **Leitura:** {referência exata do JSON, ex: "2 Reis 18-19"}
  - **Pasta:** docs/devocionais/{YYYY-MM-DD}-{livro-lower}-{capitulos}/
  ```
- Informe ao usuário que o próximo passo é `/plan` para tomar as decisões pastorais do devocional.
