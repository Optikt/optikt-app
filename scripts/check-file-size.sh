#!/usr/bin/env bash
# DT1 size gate.
# Source files (non-spec) >500 lines fail; >300 lines warn.
# Non-blocking until DT1 closes — pass --strict to fail on the warn threshold too.
set -euo pipefail

STRICT=0
[ "${1:-}" = "--strict" ] && STRICT=1

FAIL=0
WARN_COUNT=0
while IFS= read -r -d '' f; do
	lines=$(wc -l <"$f")
	if [ "$lines" -gt 500 ]; then
		echo "FAIL  $lines  $f"
		FAIL=1
	elif [ "$lines" -gt 300 ]; then
		echo "WARN  $lines  $f"
		WARN_COUNT=$((WARN_COUNT + 1))
	fi
done < <(find src -type f \( -name "*.ts" -o -name "*.svelte" \) \
	! -name "*.spec.ts" ! -name "*.test.ts" -print0)

if [ "$FAIL" -eq 1 ]; then
	echo "size-gate: source files >500 lines found" >&2
	exit 1
fi
if [ "$STRICT" -eq 1 ] && [ "$WARN_COUNT" -gt 0 ]; then
	echo "size-gate --strict: source files >300 lines found" >&2
	exit 1
fi

echo "size-gate OK ($WARN_COUNT files >300 lines, none >500)"
exit 0