#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="$ROOT/.env.development.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: .env.development.local not found."
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

: "${SUPABASE_URL:?ERROR: SUPABASE_URL is missing}"
: "${SUPABASE_PUBLISHABLE_KEY:?ERROR: SUPABASE_PUBLISHABLE_KEY is missing}"

DEVICE="${1:-emulator-5554}"
API_BASE_URL="${MOBILE_API_BASE_URL:-http://10.0.2.2:3000}"

echo "Starting TaraVerse development app"
echo "Device: $DEVICE"
echo "API: $API_BASE_URL"
echo "Supabase configuration: present"

cd "$ROOT/mobile"

flutter run -d "$DEVICE" \
  --dart-define=SUPABASE_URL="$SUPABASE_URL" \
  --dart-define=SUPABASE_ANON_KEY="$SUPABASE_PUBLISHABLE_KEY" \
  --dart-define=API_BASE_URL="$API_BASE_URL"
