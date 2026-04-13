---
name: write-devotional
description: >-
  Escreve roteiros devocionais para podcast com teologia reformada (Pactualismo Progressivo + Greidanus).
  Garante linguagem popular, estrutura de 8 parágrafos, coesão temática e validação rigorosa.
  Use quando o usuário solicitar um devocional, reflexão, roteiro ou passar uma data de leitura.
---

# Write Devotional

Gere roteiros de podcast devocional com base em um plano de leitura bíblica anual.

## 🔄 Fluxo de Execução

### Fase 1: Entrada & Normalização

- Receba a data do usuário (ex: `16/03`, `2026-03-16`, `março 16`).
- Normalize para `DD/MM` (título), `YYYY-MM-DD` (arquivo) e **dia + mês por extenso** (intro de gravação, ex: `13 de abril`).
- Se ausente, solicite usando a ferramenta AskQuestion.

### Fase 2: Contexto Bíblico

- Leia `data/readings-2026.json` e localize a entrada da data.
- Extraia o campo `reading` (ex: `"1 Reis 6-7"`).
- Se não encontrar, informe e pare.

### Fase 3: Planejamento Interno (silencioso — não imprima)

Antes de escrever, resolva internamente estes eixos. **Nunca os inclua na saída final.**

1. **Tom:** Conversa íntima, acessível, zero academicismo.
2. **Via de Greidanus:** ESCOLHA EXATAMENTE UMA em [docs/theology/greidanus-vias-cristologicas.md](docs/theology/greidanus-vias-cristologicas.md): Progressão histórico-redentiva, Promessa e cumprimento, Tipologia, Analogia, Temas longitudinais, Referências do Novo Testamento, Contraste.
3. **Tensão principal:** Qual o conflito, medo ou falha central que o texto expõe?
4. **Cenário de aplicação:** ESCOLHA APENAS UM → `Família` OU `Escola`.
5. **Citação NT:** O texto base é citado explicitamente no NT? (Sim/Não. Se sim, anote a referência.)

### Fase 4: Redação (regras rígidas)

Siga [docs/RULES.md](docs/RULES.md) para estilo. Restrições obrigatórias:

- **Idioma:** Português Brasileiro falado. Substitua jargões teológicos por palavras do cotidiano.
- **Coesão (ganchos temáticos):** A última frase de cada parágrafo deve conter um gancho conceitual que puxa naturalmente o tema do parágrafo seguinte. NUNCA use conectivos óbvios ("Além disso", "Por outro lado", "Concluindo", "Nesse sentido").
- **NVI:** Citação opcional. Se usar, use terminologia exata da Nova Versão Internacional.
- **Zero clichê/adjetivo vazio:** Proibido "Vivemos em uma sociedade", "Nos dias de hoje", "Desafiador", "Impressionante". Corte adjetivos que não agregam informação concreta.

Consulte teologia quando precisar:

- [docs/theology/pactualismo-progressivo.md](docs/theology/pactualismo-progressivo.md)
- [docs/theology/greidanus-vias-cristologicas.md](docs/theology/greidanus-vias-cristologicas.md)

Exemplos de calibre:

- [examples.md](examples.md)

**Estrutura de saída (na ordem exata):**

1. **Título:** Formato estrito: `DD/MM: Quando [título curto e criativo] ([Referência Bíblica])`
2. **Introdução de gravação (obrigatória):** Imediatamente após o título, **antes** da descrição Spotify, inclua **um parágrafo corrido** (texto falado ao microfone), **sem rótulo de seção**. Formato fixo:
   `Bom dia, hoje é dia {N} de {mês por extenso} e vamos refletir sobre o texto de {referência falada em minúsculas}: {só a parte criativa "Quando ..." do título, sem repetir a data `DD/MM` nem a referência entre parênteses}.`
   - **Referência falada:** a partir do `reading` do JSON (ex: `1 Reis 8-9` → `1 reis 8 a 9`; capítulo único → `1 reis 8` sem "a").
   - **Parte "Quando ...":** copie exatamente o trecho do H1 depois de `DD/MM: ` até antes de ` (` da referência.
3. **Descrição Spotify:** Uma ÚNICA frase factual, em **cadência de acontecimentos** (não um resumo vago). Prefira **cadeia de verbos e nomes** na ordem do texto: quem faz o quê, em sequência, separado por vírgulas, até fechar o arco da leitura. Evite voz impessoal ("descreve-se", "o texto mostra"), verbos genéricos ("supervisiona", "acontece") e adjetivos decorativos. Ver padrão completo em [docs/RULES.md](docs/RULES.md) e [examples.md](examples.md).
4. **Roteiro (8 parágrafos exatos):**
   - **P1 (Gancho + texto):** Analogia cultural + tensão existencial. OBRIGATÓRIO: a última frase apresenta o texto bíblico.
   - **P2 (Cenário):** Conte o contexto ou a história de forma narrativa e simples.
   - **P3 (Criação):** Intenção boa e original de Deus naquela situação.
   - **P4 (Queda):** A bagunça, o pecado ou a dor que o texto mostra. Faça sentir o peso.
   - **P5 (Redenção):** Onde a graça, a ajuda ou a promessa de Deus aparece no texto para resolver a bagunça?
   - **P6 (Cristologia — Greidanus):** Use a via escolhida na Fase 3. Se houver citação NT (Fase 3 item 5), USE-A obrigatoriamente e mostre como interpreta a história. Ligue Jesus à tensão inicial.
   - **P7 (Aplicação):** EXCLUSIVAMENTE no cenário escolhido na Fase 3 item 4. Um exemplo concreto, pé no chão, zero abstrações.
   - **P8 (Esperança):** OBRIGATÓRIO começar com `A minha oração é para que...`. Termine com uma palavra de ânimo.

### Fase 5: Validação interna (loop de autocorreção)

Antes de liberar a saída, execute esta checagem silenciosa. Se falhar, reescreva:

- [ ] Contagem de palavras nos **8 parágrafos do roteiro** (após Spotify) está entre **700 e 900** — não conte título, introdução de gravação nem descrição Spotify.
- [ ] Exatamente 8 parágrafos no corpo do texto (após Spotify).
- [ ] Título segue `DD/MM: Quando ... (Ref)`.
- [ ] Introdução de gravação: logo após o título; começa com `Bom dia,`; inclui `hoje é dia {N} de {mês}`; `vamos refletir sobre o texto de ...`; referência falada minúscula com ` a ` entre capítulos se intervalo; dois-pontos e a parte `Quando ...` igual ao título.
- [ ] Descrição Spotify: uma frase só, factual, com **sequência clara de fatos/personagens** (cadência tipo "X faz Y, Z faz W..."); sem voz impessoal nem verbo vazio.
- [ ] Zero clichês e marcadores de transição óbvios.
- [ ] P1 termina com a apresentação do texto bíblico.
- [ ] P6 usa a via de Greidanus escolhida (exclusiva) e conecta a Cristo.
- [ ] P7 foca APENAS no cenário (Família ou Escola).
- [ ] P8 começa exatamente com `A minha oração é para que...`.
- [ ] Transições invisíveis (ganchos temáticos fluem sem quebras).

### Fase 6: Saída e salvamento

- Imprima APENAS o texto final formatado. Sem cabeçalhos extras, sem notas de rodapé.
- Se solicitado a salvar: `docs/devocionais/{YYYY-MM-DD}-{livro-lower}-{capitulos}.md`
  - Livro: minúsculo, sem acentos (`1-reis`, `genesis`, `juizes`).
  - Capítulos: separados por hífen (`6-7`, `13-16`).

## 📂 Arquivos de referência

- [docs/theology/greidanus-vias-cristologicas.md](docs/theology/greidanus-vias-cristologicas.md)
- [docs/theology/pactualismo-progressivo.md](docs/theology/pactualismo-progressivo.md)
- [docs/RULES.md](docs/RULES.md)
- [examples.md](examples.md)
- `data/readings-2026.json`
