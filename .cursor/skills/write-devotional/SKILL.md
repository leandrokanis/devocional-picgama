---
name: write-devotional
description: >-
  Write devotional scripts for a reformed theology podcast. Use when the user
  asks to write a devotional, create a reflection, generate a podcast script,
  or mentions "devocional", "reflexão", "roteiro", or a Bible reading date.
---

# Write Devotional

Generate a devotional podcast script based on a Bible reading date from the annual plan.

## Workflow

### Phase 1: Input

Receive a **date** from the user (e.g. `16/03`, `2026-03-16`, or `março 16`). Normalize to `YYYY-MM-DD`.

If no date is provided, ask for one using the AskQuestion tool.

### Phase 2: Lookup

Read `data/readings-2026.json` and find the entry matching the date. Extract the `reading` field (e.g. `"Juízes 13-16"`).

If no entry is found, inform the user and stop.

### Phase 3: Plan (internal — never output this)

Before writing, decide internally:

1. **Tone** for this episode
2. **Greidanus pathway** — choose exactly ONE from [docs/theology/greidanus-vias-cristologicas.md](docs/theology/greidanus-vias-cristologicas.md):
   - Progressão histórico-redentiva
   - Promessa e cumprimento
   - Tipologia
   - Analogia
   - Temas longitudinais
   - Referências do Novo Testamento
   - Contraste
3. **Core tension** the text presents

### Phase 4: Write

Read and follow **every rule** in [docs/RULES.md](docs/RULES.md). The key constraints are:

- **Role**: Reformed theologian (Progressive Covenantalism + Greidanus) writing as a casual podcast host
- **Language**: Spoken Brazilian Portuguese, extremely simple and conversational
- **Bible version**: NVI only — if quoting Scripture, use exact NVI wording; quoting is optional
- **Style**: Zero clichés, invisible transitions between paragraphs

Consult theological background as needed:
- [docs/theology/pactualismo-progressivo.md](docs/theology/pactualismo-progressivo.md)
- [docs/theology/greidanus-vias-cristologicas.md](docs/theology/greidanus-vias-cristologicas.md)

Consult gold-standard examples:
- [examples.md](examples.md)

**Output structure** (in order):

1. **Title**: `DD/MM: Quando [creative short title] ([Bible Reference])`
2. **Spotify description**: Bold one-liner, factual summary of the passage
3. **8 paragraphs**:
   - P1 — Hook + introduce the Bible text
   - P2 — Story/context of the passage
   - P3 — Creation (God's good design)
   - P4 — Fall (sin, pain, brokenness)
   - P5 — Redemption (grace in the text)
   - P6 — Christology via the chosen Greidanus pathway
   - P7 — Practical application (real-life, concrete)
   - P8 — Hope (encouragement to close)

### Phase 5: Validate

Before saving, verify all of these:

- [ ] Word count of the 8 paragraphs is between **700 and 1000** (count and report)
- [ ] Exactly 8 body paragraphs (after title and Spotify line)
- [ ] Title follows format `DD/MM: Quando ... (Reference)`
- [ ] No clichés ("Vivemos em uma sociedade", "Nos dias de hoje", etc.)
- [ ] No paragraph starts with an obvious transition marker
- [ ] Any Scripture quotes match NVI wording

If validation fails, rewrite the failing parts before saving.

### Phase 6: Save

Save to `docs/devocionais/{YYYY-MM-DD}-{book}-{chapters}.md`

- Book name: lowercase, no accents (genesis, exodo, juizes, rute, etc.)
- Chapters: hyphen-separated range (1-3, 13-16)

Example: `docs/devocionais/2026-03-23-rute-1-4.md`
