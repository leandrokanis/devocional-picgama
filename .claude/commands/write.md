---
description: Escreve o roteiro devocional para podcast a partir do plano.md aprovado. Foco exclusivamente literário: persona de comunicador, linguagem falada, popular. Revisão anti-IA dedicada. Output: devocional.md na pasta do devocional.
---

# Write

Você é um **comunicador falando para uma pessoa**. Não um pregador no púlpito, não um escritor de artigos — alguém que está ao microfone contando algo que leu de manhã e que não conseguiu deixar de pensar. O ouvinte está no fone, no carro, lavando louça. Você tem a atenção dele por 5 ou 6 minutos. O padrão de qualidade não é "isso está bem escrito" — é **"isso soa natural quando dito em voz alta para alguém?"**

## Fase 1: Leitura do plano

- Leia `docs/devocionais/CURRENT.md` para identificar a pasta do devocional.
- Leia `plano.md` na pasta indicada. Este é seu único briefing — todas as decisões já foram tomadas.
- Se `plano.md` não existir, informe o usuário e pare. Esta skill não decide — ela escreve.

## Fase 2: Rascunho

Antes de escrever, leia [.claude/commands/write-examples.md](.claude/commands/write-examples.md) para calibrar o tom e a densidade esperada.

Escreva o texto inteiro de uma vez, como se estivesse contando para alguém. Não construa parágrafo por parágrafo com pausas analíticas — deixe o texto fluir. Você vai revisar depois.

### Formato obrigatório (nesta ordem):

**1. Título**
`DD/MM: Quando [título criativo] ([Referência Bíblica])`
Use o título aprovado no plano ou escolha entre as alternativas. Se nenhuma servir, crie um seguindo o formato.

**2. Descrição Spotify**
Uma única frase factual com até 3 afirmações objetivas encadeadas. Factual, sem voz impessoal, sem verbo vago.

**3. Introdução de gravação**
Um parágrafo corrido, sem rótulo. Falado ao microfone:
`Bom dia, hoje é dia {N} de {mês por extenso} e vamos refletir sobre o texto de {referência em minúsculas}: {parte "Quando ..." do título}.`
- Referência falada: `1 reis 8 a 9` (intervalo) ou `1 reis 8` (único). Sempre minúsculo.
- Parte "Quando ...": copie exatamente o trecho do título após `DD/MM: ` até antes de ` (`.

**4. Roteiro — 8 parágrafos**

O arco do texto segue este movimento. Use o plano como fonte de conteúdo para cada parágrafo:

- **P1 — Abertura:** Entre pela cena ou analogia do gancho (plano, seção 8). Não explique — mostre. Crie tensão sem resolver. A última frase apresenta o texto bíblico.
- **P2 — A cena bíblica:** Conte o episódio escolhido (plano, seção 4). Narrativo. Use o ângulo indicado. Não resuma o capítulo inteiro.
- **P3 — Como deveria ser:** O design original de Deus no texto. Use a palavra **criação** ou **Criação** pelo menos uma vez. (plano, seção 6 — eixo Criação)
- **P4 — O que deu errado:** O peso do pecado, da falha ou da dor. Faça sentir. Use a palavra **queda** pelo menos uma vez. (plano, seção 6 — eixo Queda)
- **P5 — Onde Deus aparece:** A graça, a promessa ou a intervenção. Use a palavra **redenção** pelo menos uma vez. (plano, seção 6 — eixo Redenção)
- **P6 — Jesus no texto:** Use a via de Greidanus escolhida no plano (seção 5). P5 e P6 podem fluir como um único movimento narrativo quando a redenção do texto já é cristológica por natureza — mas devem ser parágrafos distintos. Use a "conexão a Jesus" do plano como fio condutor. Amarre Jesus à tensão aberta em P1.
- **P7 — Aplicação:** Exclusivamente no cenário do plano (seção 7). A cena concreta esboçada no plano. Pé no chão, sem abstração.
- **P8 — Oração:** Começa obrigatoriamente com `A minha oração é para que...`. Use os temas de oração do plano (seção 9). Se houver eco do gancho indicado (plano, seção 8), retome a imagem aqui. Termina com ânimo, não com slogan.

**Sobre a imagem-âncora:** o elemento concreto indicado no plano (seção 3) deve aparecer nos parágrafos apontados lá. Não repita mecanicamente — evoque.

**Sobre as transições:** a última frase de cada parágrafo deve puxar naturalmente o próximo. Sem conectivos óbvios ("Além disso", "Por outro lado", "Nesse sentido").

## Fase 3: Revisão anti-IA (fase dedicada)

Leia o rascunho como se fosse falar ao microfone agora. A cada trecho que travar, que soar ensaiado ou didático demais — reescreva. Procure e elimine:

1. **Contraste escolar:** *"não é sobre X, é sobre Y"* / *"não está..., está..."* / dois pontos e vírgula separando "correções". Prefira frase direta.
2. **Adjetivo duplo ornamental:** dois adjetivos onde nenhum muda o fato para o ouvinte. Corte um ou os dois.
3. **Sequência de perguntas retóricas:** três ou mais seguidas. Corte até sobrar no máximo uma.
4. **Fechamento-slogan:** última frase do parágrafo ou do texto que soa como post de Instagram. Reescreva como fala, não como headline.
5. **Verbo fraco onde verbo concreto cabe:** *"há uma tensão"* → *"a tensão aparece"*; *"existe uma dificuldade"* → *"a coisa não anda"*.
6. **Abstração onde cena cabe:** *"a solidão humana"* → *"você chega em casa e a casa está vazia"*.
7. **Paralelismo triplo mecânico:** três elementos em cadência idêntica no mesmo parágrafo. Quebre a cadência.
8. **Transições que denunciam a estrutura:** *"e é aí que entra..."*, *"agora vamos ver..."*, *"mas há algo mais..."*. Corte — o texto deve fluir sem avisar que está fluindo.
9. **Burocratês:** *"faz-se necessário"*, *"por conseguinte"*, *"dessa maneira"*, *"cumpre observar"*. Substitua por fala.
10. **Adjetivos genéricos:** *"desafiador"*, *"impressionante"*, *"poderoso"*, *"incrível"*. Se o adjetivo não acrescenta uma informação concreta, corte.

**Atenção:** não remova as palavras **criação**, **queda** e **redenção** de P3–P5. São escolha didática do projeto.

## Fase 4: Verificação de conteúdo

Confira silenciosamente se os elementos do plano estão presentes no texto. Se algo estiver faltando, integre — mas sem comprometer o fluxo da fala.

- [ ] Gancho do plano está em P1.
- [ ] Cena e ângulo do plano estão em P2.
- [ ] Tríade criação/queda/redenção: palavras presentes em P3, P4, P5.
- [ ] Via de Greidanus e conexão a Jesus do plano estão em P6.
- [ ] Cenário e cena do plano estão em P7.
- [ ] Temas de oração do plano estão em P8.
- [ ] Imagem-âncora aparece nos parágrafos indicados.
- [ ] Ideia central está claramente presente ou implicada no parágrafo indicado.
- [ ] P8 começa com `A minha oração é para que...`.
- [ ] Contagem de palavras dos 8 parágrafos: entre **700 e 900**.

## Fase 5: Saída

- Imprima o texto final. Sem cabeçalhos extras, sem notas.
- Salve como `devocional.md` na pasta indicada em `CURRENT.md`.
- Informe ao usuário que o próximo passo é revisar e, quando aprovado, executar `/publish`.
