---
description: Estudo exegético do texto bíblico pelo método semio-discursivo de Júlio Zabatiero. Use com uma data (ex: 25/04, 2026-04-25) ou referência direta (ex: 2 Reis 18-19). Primeiro passo do fluxo estudo → cosmovisão → plano → escrita → publicação.
---

# Study

Realiza a análise exegética do texto pelo **método semio-discursivo de Júlio Zabatiero**: o texto lido como **ação de linguagem situada**.

## Fase 1: Entrada & Localização

- Receba a data ou referência bíblica (ex: `25/04`, `2026-04-25`, `2 Reis 18-19`).
- Se for uma data, leia `data/readings-2026.json` e localize o campo `reading` da entrada correspondente.
- Se for referência direta, use-a como texto base.
- Se não encontrar, informe e pare.

## Fase 2: Leitura de referência metodológica

Antes de analisar, leia integralmente:

- [docs/theology/zabatiero-semio-discursivo.md](docs/theology/zabatiero-semio-discursivo.md)

> A leitura Criação-Queda-Redenção e a cristologia **não** são feitas aqui — pertencem ao passo `/cosmovisão`, que vem depois. O estudo entrega a matéria exegética (sobretudo o **percurso temático** e a **dimensão missional**) sobre a qual a cosmovisão trabalha.

## Fase 3: Análise (saída estruturada)

Produza o estudo seguindo o método. Documento interno do escritor — não é o devocional. Linguagem técnica e precisa.

> **Método completo, sempre.** Rode **os cinco ciclos**, com as **tabelas** previstas (Ciclo 1 e Ciclo 4). Nenhum ciclo é opcional. Em texto lírico/sapiencial, o Ciclo 1 é feito assim mesmo — mapeando vozes, gestos e mudanças de estado dentro do mundo do poema. Profundidade e rigor acadêmico em cada ciclo.

---

### Tradução

- **Tradução livre / cotejo:** [Leitura própria do texto. O que repete, o que estranha, o que trava. 2-4 frases ou os versos-chave em paráfrase.]

---

### Preparação

- **Autoria:** [...]
- **Contexto histórico:** [...]
- **Destinatários:** [...]
- **Data:** [...]
- **Tema geral:** [...]

*(Curto e funcional — só o cenário da ação.)*

---

### Ciclo 1 — Dimensão espaço-temporal da ação

1. **Quem age, onde, quando, o quê, a quem:** [tabela — agente · ação · paciente · lugar · tempo]
2. **Caracterização** de agentes, pacientes, tempo e espaço: [...]
3. **Organização no tempo/espaço:** [breve linha do tempo ou sequência]

---

### Ciclo 2 — Dimensão teológica da ação

1. **Conexões (intertextualidade):** [outros textos evocados por citação / alusão / estilização — em especial citações ou alusões no NT, que adiantam a ponte cristológica para o passo cosmovisão]
2. **Figuras:** [signos concretos do texto e o que significam — alimenta a imagem-âncora]
3. **Temas:** [temas gerais tratados]
4. **Percurso temático:** [até 3 — pares de temas em tensão; título + sentido de cada par]
5. **Tema principal:** [o grande percurso que unifica os demais — uma frase]

---

### Ciclo 3 — Dimensão sociocultural da ação

[Como a sociedade/cultura/religião da época tratava cada tema do percurso temático — honra/vergonha, pureza, parentesco, poder, economia, culto.]

---

### Ciclo 4 — Dimensão psicossocial da ação

[Motivações e reações dos personagens diante de cada tema do percurso — tabela: personagem · motivação · reação. Alimenta a tensão existencial do plano.]

---

### Ciclo 5 — Dimensão missional da ação

> Levanta **matéria-prima** de aplicação. O ângulo final é decisão do `/plan` — aqui não se escolhe, se mapeia.

1. **Tratamento atual:** [como a cultura de hoje trata cada tema do percurso — cite autores/peças culturais quando ajudar]
2. **Motivações atuais:** [motivações, medos e objetivos do público moderno quanto a cada tema]
3. **Ações:** [ações práticas por motivação — replicando ou reescrevendo as ações dos personagens]

---

## Fase 4: Validação interna

- [ ] Tradução e Preparação preenchidas.
- [ ] **Os cinco ciclos presentes** — nenhum omitido.
- [ ] Ciclo 1 com tabela (agente · ação · paciente · lugar · tempo) e linha do tempo.
- [ ] Ciclo 2 com conexões, figuras, temas, **percurso temático** (até 3 pares) e **tema principal** em uma frase.
- [ ] Ciclo 3 (sociocultural) e Ciclo 4 com tabela (personagem · motivação · reação).
- [ ] Ciclo 5 com tratamento atual, motivações e ações.
- [ ] Conexões intertextuais do Ciclo 2 anotadas (insumo da cristologia na cosmovisão).

## Fase 5: Saída

- Imprima o estudo completo.
- Crie a pasta (se não existir) e salve:
  - Pasta: `docs/devocionais/{YYYY-MM-DD}-{livro-lower}-{capitulos}/`
  - Arquivo: `estudo.md`
  - Livro: minúsculo, sem acentos (`1-reis`, `genesis`, `juizes`). Capítulos com hífen (`18-19`).
  - Exemplo: `docs/devocionais/2026-04-25-2-reis-18-19/estudo.md`
- **Atualize `docs/devocionais/CURRENT.md`:**
  ```
  ---
  # Devocional em andamento

  > Arquivo de estado. Atualizado automaticamente pela skill `/study`.
  > Lido por todas as skills como fonte de contexto do devocional atual.

  - **Data:** {YYYY-MM-DD}
  - **Leitura:** {referência exata do JSON, ex: "2 Reis 18-19"}
  - **Pasta:** docs/devocionais/{YYYY-MM-DD}-{livro-lower}-{capitulos}/
  ```
- Informe ao usuário que o próximo passo é `/cosmovisão` para a leitura Criação-Queda-Redenção e o levantamento das vias cristológicas.
