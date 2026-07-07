#!/usr/bin/env bash
# Regenerate counter-state screenshots into /tmp/decay2-<state>.png
# (starts a throwaway mock-tosu server + headless chromium screenshot pass).
# Usage: dev/shots.sh                    # menu play result simple
#        dev/shots.sh play               # just one
#        dev/shots.sh simple             # the minimal-variant mockup (dev/simple.html)
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-24071}"
CHROME="$(command -v chromium-browser || command -v chromium || command -v google-chrome-stable || true)"
[ -z "$CHROME" ] && { echo "no chromium found"; exit 1; }

states=("$@")
[ ${#states[@]} -eq 0 ] && states=(menu play result simple)

node "$DIR/dev/gen-fixtures.cjs"

# start server if the port isn't already serving
started=""
if ! curl -sf -o /dev/null "http://127.0.0.1:$PORT/" 2>/dev/null; then
	PORT="$PORT" node "$DIR/dev/mock-tosu.js" >/tmp/mock-tosu.log 2>&1 &
	started=$!
	trap '[ -n "$started" ] && kill "$started" 2>/dev/null || true' EXIT
	sleep 1
fi

shoot() { # url size out
	"$CHROME" --headless=new --hide-scrollbars --force-device-scale-factor=2 \
		--window-size="$2" --default-background-color=00000000 --disable-gpu \
		--virtual-time-budget=6000 \
		--screenshot="$3" "$1" >/dev/null 2>&1
	echo "shot: $3"
}

for s in "${states[@]}"; do
	# the minimal variant is a self-contained static page (its own size) with
	# menu/play/result chosen via ?scene=; the live states render index.html
	# driven by ?mockScene=.
	if [ "$s" = "simple" ]; then
		for sc in menu play result; do
			shoot "http://127.0.0.1:$PORT/dev/simple.html?scene=$sc" "500,118" "/tmp/decay2-simple-$sc.png"
		done
	else
		shoot "http://127.0.0.1:$PORT/?mockScene=$s" "500,218" "/tmp/decay2-$s.png"
	fi
done

echo "done — preview with: dev/show.sh ${states[*]}"
