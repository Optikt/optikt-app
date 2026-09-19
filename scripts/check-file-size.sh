#!/usr/bin/env bash
# DT1 size gate (closed 2026-09-14, blocking in CI).
# Source files (non-spec) >520 lines fail; >300 lines warn.
# The former PaymentForm.svelte exception (518) was resolved in DT9 PR-5:
# its reactive money logic now lives in payments/paymentFormModel.svelte.ts
# + payments/paymentFormValues.ts (built on the DT9 test harness).
# Pass --strict to fail on the warn threshold too.
set -euo pipefail

STRICT=0
[ "${1:-}" = "--strict" ] && STRICT=1

FAIL=0
WARN_COUNT=0
while IFS= read -r -d '' f; do
	lines=$(wc -l <"$f")
	if [ "$lines" -gt 520 ]; then
		echo "FAIL  $lines  $f"
		FAIL=1
	elif [ "$lines" -gt 300 ]; then
		echo "WARN  $lines  $f"
		WARN_COUNT=$((WARN_COUNT + 1))
	fi
done < <(find src -type f \( -name "*.ts" -o -name "*.svelte" \) \
	! -name "*.spec.ts" ! -name "*.test.ts" -print0)

if [ "$FAIL" -eq 1 ]; then
	echo "size-gate: source files >520 lines found" >&2
	exit 1
fi
if [ "$STRICT" -eq 1 ] && [ "$WARN_COUNT" -gt 0 ]; then
	echo "size-gate --strict: source files >300 lines found" >&2
	exit 1
fi

echo "size-gate OK ($WARN_COUNT files >300 lines, none >520)"
exit 0