#!/usr/bin/env bash
# Claude Code PostToolUse hook (matcher Edit|Write).
#
# After Claude edits a .ts or .tsx file under src/, format it with Prettier
# and lint it with ESLint. Remaining ESLint problems go back to Claude as
# PostToolUse JSON {"decision":"block","reason":...}, which Claude Code shows
# next to the tool result. The edit itself has already happened and is never
# undone.
#
# The hook never fails the session: every error path exits 0.
#
# The repo root comes from the edited file, not from CLAUDE_PROJECT_DIR,
# because in a git worktree CLAUDE_PROJECT_DIR stays at the primary checkout.

input=$(cat)

# Cheap pre-filter: skip starting node for files that are not TypeScript.
case "$input" in
  *.ts\"*|*.tsx\"*) ;;
  *) exit 0 ;;
esac

file=$(printf '%s' "$input" | node -e '
let s = "";
process.stdin.on("data", (d) => (s += d)).on("end", () => {
  try {
    const j = JSON.parse(s);
    const p = j && j.tool_input && j.tool_input.file_path;
    if (typeof p === "string" && p) {
      process.stdout.write(require("path").resolve(j.cwd || process.cwd(), p));
    }
  } catch {}
});
' 2>/dev/null)

case "$file" in
  */node_modules/*) exit 0 ;;
esac
[[ "$file" =~ \.tsx?$ ]] || exit 0
[ -f "$file" ] || exit 0

root=$(git -C "$(dirname "$file")" rev-parse --show-toplevel 2>/dev/null) || exit 0
case "${file#"$root"/}" in
  src/*) ;;
  *) exit 0 ;;
esac
[ -x "$root/node_modules/.bin/eslint" ] || exit 0

cd "$root" || exit 0
node_modules/.bin/prettier --write --log-level warn "$file" >/dev/null 2>&1

lint=$(node_modules/.bin/eslint --no-warn-ignored "$file" 2>&1)
if [ $? -ne 0 ] && [ -n "$lint" ]; then
  printf '%s' "$lint" | node -e '
let s = "";
process.stdin.on("data", (d) => (s += d)).on("end", () => {
  process.stdout.write(JSON.stringify({
    decision: "block",
    reason: "ESLint found problems in the file you just edited. Fix them before you finish:\n" + s.trim()
  }));
});
'
fi
exit 0
