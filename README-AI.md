# README-AI.md

> Developer setup for AI-assisted work on this repo. Agent instructions live in `AGENTS.md`; background in `.ai-context/`.

## One-time setup after cloning

```bash
npm install                          # also runs: git config core.hooksPath .githooks
git config core.hooksPath            # should print .githooks
```

The hooks:

- **pre-commit:** when `AGENTS.md` is staged, copies it to `CLAUDE.md`, `GEMINI.md` and `.github/copilot-instructions.md` and stages the copies. Edit only `AGENTS.md`.
- **commit-msg:** rejects AI attribution lines (`Co-Authored-By: Claude`, "Generated with ..."). See `AGENTS.md` > Git Commits.

## Day-to-day

### Plan before coding

Ask the agent to plan the change. It reads `.ai-context/`, checks `planning/` for an existing plan, saves the new plan to `planning/<slug>.md` and **waits for your approval** before writing code. Progress is tracked in `planning/progress.md`.

### Write tests

```
Write tests for <module>. Follow the testing principles in AGENTS.md.
Include adversarial inputs and negative paths.
```

Claude Code loads `.claude/skills/write-tests/SKILL.md` for test work.

### Before committing

```bash
npm run check
```

### Explorations

When a session produces a non-trivial investigation or comparison, the agent offers to save it to `.ai-context/EXPLORATIONS/YYYY-MM-DD-slug.md`. Ask it to check `EXPLORATIONS/index.md` before starting a new investigation.

## Per-tool notes

- **Claude Code:** reads `CLAUDE.md`. `.claude/settings.json` allows the npm scripts and runs `.claude/hooks/lint-edited-file.sh` after each edit, which formats the edited `src/**/*.ts(x)` file and reports ESLint problems back to Claude.
- **GitHub Copilot:** reads `.github/copilot-instructions.md`.
- **Gemini CLI:** reads `GEMINI.md`.
- **Cursor and others:** read `AGENTS.md`.

## Troubleshooting

- **Copies out of date:** `git config core.hooksPath .githooks`, then touch and stage `AGENTS.md`.
- **Hook not executable:** `chmod +x .githooks/* .claude/hooks/*`.
