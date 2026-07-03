#!/usr/bin/env bash
# Regenerate counter-state screenshots into /tmp/decay2-<state>.png
# (starts a throwaway mock-tosu server + headless chromium screenshot pass).
# Usage: dev/shots.sh                    # menu play result
#        dev/shots.sh play               # just one
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-24071}"
CHROME="$(command -v chromium-browser || command -v chromium || command -v google-chrome-stable || true)"
[ -z "$CHROME" ] && { echo "no chromium found"; exit 1; }

states=("$@")
[ ${#states[@]} -eq 0 ] && states=(menu play result)

node "$DIR/dev/gen-fixtures.cjs"

# start server if the port isn't already serving
started=""
if ! curl -sf -o /dev/null "http://127.0.0.1:$PORT/" 2>/dev/null; then
	PORT="$PORT" node "$DIR/dev/mock-tosu.js" >/tmp/mock-tosu.log 2>&1 &
	started=$!
	trap '[ -n "$started" ] && kill "$started" 2>/dev/null || true' EXIT
	sleep 1
fi

for s in "${states[@]}"; do
	"$CHROME" --headless=new --hide-scrollbars --force-device-scale-factor=2 \
		--window-size=500,218 --default-background-color=00000000 --disable-gpu \
		--virtual-time-budget=6000 \
		--screenshot="/tmp/decay2-$s.png" "http://127.0.0.1:$PORT/?mockScene=$s" >/dev/null 2>&1
	echo "shot: /tmp/decay2-$s.png"
done

echo "done — preview with: dev/show.sh ${states[*]}"
