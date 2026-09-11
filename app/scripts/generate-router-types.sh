#!/bin/sh
# Regenerates .expo/types/router.d.ts (gitignored, Expo Router typed routes).
# expo export never runs this generation, and a stale/missing file makes tsc
# fail or silently under-check real routes - so run this before tsc/export
# instead of relying on a warm `expo start` cache.
set -e
cd "$(dirname "$0")/.."

rm -f .expo/types/router.d.ts

BROWSER=none npx expo start --web --offline --port "${EXPO_TYPEGEN_PORT:-8098}" >/tmp/expo-router-typegen.log 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null || true; wait $PID 2>/dev/null || true' EXIT

i=0
while [ ! -f .expo/types/router.d.ts ] && [ "$i" -lt 30 ]; do
  sleep 1
  i=$((i + 1))
done

if [ ! -f .expo/types/router.d.ts ]; then
  echo "generate-router-types: router.d.ts was not generated within 30s" >&2
  cat /tmp/expo-router-typegen.log >&2
  exit 1
fi
