# Devocionais

Pasta para devocionais escritos a partir dos textos bíblicos do plano de leitura.

## Estrutura

```
docs/
├── README.md                    # Este arquivo
├── RULES.md                     # Regras para escrita dos devocionais (usar com o agente)
├── pactualismo-progressivo.md   # Base teológica: pactos e revelação progressiva
├── greidanus-vias-cristologicas.md  # Interpretação histórico-redentora e 7 vias para Cristo
└── devocionais/                 # Um devocional por texto bíblico
```

## Formato de arquivo (fixo)

Cada devocional é um arquivo `.md` em `docs/devocionais/` com nome:

```
{YYYY-MM-DD}-{livro}-{capitulos}.md
```

- **Data:** `YYYY-MM-DD` (ano-mês-dia)
- **Livro:** minúsculo, sem acentos (genesis, exodo, juizes, salmos, etc.)
- **Capítulos:** intervalo com hífen (1-3, 4-6, 1-2)

Exemplos:
- `2026-03-16-juizes-1-3.md`
- `2026-01-01-genesis-1-3.md`
- `2026-02-24-exodo-17-20.md`

## Como gerar um devocional

1. Abra o chat do Cursor.
2. Referencie as regras e o plano de leitura: `@docs/RULES.md` e `@data/readings-2026.json`
3. Informe a **Data** (ex: 16/03 ou 2026-03-16).
4. Peça ao agente para escrever o devocional seguindo as regras.

O agente deve **buscar a referência bíblica** em `data/readings-2026.json` para a data informada. O arquivo contém um array de objetos `{ "date": "YYYY-MM-DD", "reading": "Livro X-Y" }`.

Exemplo de prompt:

> Usando @docs/RULES.md e @data/readings-2026.json, escreva o devocional para 16/03.

O agente consulta o JSON, encontra a leitura do dia e gera o devocional.
