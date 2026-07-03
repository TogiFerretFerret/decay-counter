#!/usr/bin/env bash
# Preview counter-state screenshots inline with tpix.
# Usage: dev/show.sh [menu play result ...]   (defaults to all three states)
#        dev/show.sh opt                        (show the A/B/C layout options)
set -euo pipefail

args=("$@")

# `show.sh opt` -> the layout-option comparison shots
if [ "${1:-}" = "opt" ]; then
	for v in a b c; do
		img="/tmp/opt-$v.png"
		printf '\n──────── option %s ────────\n' "$v"
		[ -f "$img" ] && tpix "$img" || printf '  (missing %s — run dev/shots.sh)\n' "$img"
	done
	exit 0
fi

states=("${args[@]}")
[ ${#states[@]} -eq 0 ] && states=(menu play result)

for s in "${states[@]}"; do
	img="/tmp/decay2-$s.png"
	printf '\n──────── %s ────────\n' "$s"
	if [ -f "$img" ]; then
		tpix "$img"
	else
		printf '  (missing %s — run dev/shots.sh)\n' "$img"
	fi
done
