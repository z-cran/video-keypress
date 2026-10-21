# The 12 Principles of High-Quality Testing

Reference for AI agents and humans. Read when writing, reviewing or planning tests. Human-curated: agents should not rewrite this page.

**Every test must answer one question: "What bug would this catch?" If the answer is "none, really", delete the test.**

## 1. Behavioral, not structural

**DO:** Assert what the user sees (the tally reads "2 · 3.5 s") or what a pure function returns.
**DON'T:** Assert that a store setter was called, or check class names.

## 2. Adversarial inputs are required

**DO:** Pass `null`, `undefined`, `""`, `0`, `NaN`, `Infinity`, negative times, duplicate names, Unicode, malformed JSON.
**DON'T:** Use only tidy sample data, or skip error branches because they are "unlikely".

## 3. Negative paths must be proven

**DO:** Prove a reserved hotkey is rejected, a corrupt import shows a message, a paused hold does not record.
**DON'T:** Test only the happy path and assume the guards work.

## 4. Readable as documentation

**DO:** Name the input and the result: "keeps a zero-length episode when the key is tapped while paused". Arrange, act, assert.
**DON'T:** `it("works")`, `it("test case 3")`.

## 5. Self-contained (DAMP over DRY)

**DO:** Inline the setup each test needs. A small local builder is fine when its arguments show what matters.
**DON'T:** Chain several `beforeEach` levels, or hide the input in a shared fixture far away.

## 6. Deterministic

**DO:** Pass `now` and an id factory into pure modules. Set `video.currentTime` explicitly in component tests.
**DON'T:** Read `Date.now()`, `Math.random()` or `crypto.randomUUID()` in code under test without a seam. Sleep.

## 7. Fast

**DO:** Keep unit tests under 100ms. Test pure modules without rendering.
**DON'T:** Mount the whole app to test a formatting function.

## 8. One behavior per test

**DO:** One behavior per test; use `it.each` for variations of one boundary.
**DON'T:** Ten near-identical tests, or one test that checks five unrelated things.

## 9. Meaningful assertions only

**DO:** Assert exact values, text and state.
**DON'T:** `toBeDefined()`, `toBeTruthy()`, snapshots of trivial output, a bare `toHaveBeenCalled()`.

## 10. Post-condition invariants on stateful flows

**DO:** After recording an episode, check the tally, the episode list and the saved session agree.
**DON'T:** Stop at "the handler ran".

## 11. Integration tests use real paths

**DO:** Render real components with real stores. Fake only what jsdom cannot do (media playback).
**DON'T:** Mock every import so the test only proves the mocks are wired.

## 12. Coverage is a trailing indicator

**DO:** Prioritize risky paths: recording, timing, persistence, file parsing.
**DON'T:** Write tests to hit a coverage number.

## AI-generated test anti-patterns

- **The validation trap:** testing the implementation instead of the requirement.
- **Happy-path tunnel vision:** clean inputs only.
- **Shallow assertions:** pass whatever the code does.
- **Copy-paste structure:** many tests, no thought about what each one catches.
- **Mock everything:** verifies wiring, not behavior.

**AI can draft. Humans must think.**
