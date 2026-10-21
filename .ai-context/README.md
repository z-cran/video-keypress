# `.ai-context/`: repo wiki for AI agents

This folder is the second layer of the repo's context setup.

| Layer                 | What it is                                                                                                                               | Always loaded?     |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 1. `AGENTS.md`        | Source of truth for agents (~2k tokens), copied to `CLAUDE.md`, `GEMINI.md` and `.github/copilot-instructions.md` by the pre-commit hook | Yes, every session |
| **2. `.ai-context/`** | **Architecture, patterns, data model, decisions, testing principles, explorations**                                                      | No, read on demand |

Agents read these pages when they need more than `AGENTS.md` gives them. Humans can read them too; they are written to be skimmed.

## Pages

| File                    | Contents                                       | Update when                             |
| ----------------------- | ---------------------------------------------- | --------------------------------------- |
| `SUMMARY.md`            | Architecture: features, stores, data flow      | A feature, store or flow changes        |
| `PATTERNS.md`           | Coding patterns with the reason for each       | A new pattern appears or one is retired |
| `DATA-MODEL.md`         | Types, storage keys, import and export formats | A type, key or file format changes      |
| `DECISIONS.md`          | Architectural Decision Records                 | A decision is made or reversed          |
| `TESTING-PRINCIPLES.md` | The 12 testing principles with DO and DON'T    | Humans only                             |
| `index.md`              | Catalog of pages                               | A page is added                         |
| `EXPLORATIONS/`         | Filed investigations and comparisons           | See `EXPLORATIONS/README.md`            |

There is no wiki automation in this repo. Keep pages current by updating them in the same change that makes them stale.
