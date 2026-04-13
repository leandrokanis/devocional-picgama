# Devocionais

Pasta para devocionais escritos a partir dos textos bíblicos do plano de leitura.

## Estrutura

```
docs/
├── README.md                              # Este arquivo
├── RULES.md                               # Regras para escrita dos devocionais
├── theology/                              # Base teológica de referência
│   ├── greidanus-vias-cristologicas.md    # Interpretação histórico-redentora e 7 vias para Cristo
│   └── pactualismo-progressivo.md         # Pactos e revelação progressiva
└── devocionais/                           # Um devocional por texto bíblico
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

Basta informar a data no chat do Cursor. A skill `write-devotional` é ativada automaticamente.

Exemplo de prompt:

> Escreva o devocional para 16/03.

O agente consulta `data/readings-2026.json`, encontra a leitura do dia, lê as regras em `docs/RULES.md` e a teologia em `docs/theology/`, e gera o devocional.

Também funciona referenciar manualmente caso necessário:

> Usando @docs/RULES.md e @data/readings-2026.json, escreva o devocional para 16/03.
