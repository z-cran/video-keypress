# Explorations

Analytical outputs filed under the convention in `AGENTS.md` > "Exploration Outputs".

## Format

One markdown file per exploration, named `YYYY-MM-DD-short-descriptive-slug.md`. Add a row to `index.md`, newest first.

## Structure (recommended)

```markdown
# <Short title>

**Date:** YYYY-MM-DD
**Session:** <tool and rough duration>
**Status:** active | superseded_by: YYYY-MM-DD-other-slug | stale

## Summary

One line on what this exploration concluded.

## Context / Question

What prompted the investigation.

## Investigation

The analysis, findings and evidence.

## Conclusion

The answer or recommendation.

## Follow-ups

Open questions or next steps.
```

## What belongs here

- Investigations that took more than 15 minutes
- Design comparisons ("X vs Y and the tradeoffs")
- Root-cause analyses
- Surprising discoveries about how the app or the browser behaves

## What does not

- Code changes: those go in commits.
- Implementation plans: those go in `planning/`.
- Quick answers: let them live in the chat.
