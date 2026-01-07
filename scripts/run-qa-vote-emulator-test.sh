#!/usr/bin/env bash
set -euo pipefail

# Runs the QA voting emulator test with automatic port fallbacks.
# Uses firebase emulators:exec so emulators start/stop automatically.
#
# Usage:
#   bash scripts/run-qa-vote-emulator-test.sh
# Environment overrides:
#   PROJECT_ID       (default: demo)
#   SERVICE_ACCOUNT  (default: /home/beano/DevProjects/NextJs/moshimoshi/moshimoshi-service-account.json)

PROJECT_ID="${PROJECT_ID:-demo}"
SERVICE_ACCOUNT="${SERVICE_ACCOUNT:-/home/beano/DevProjects/NextJs/moshimoshi/moshimoshi-service-account.json}"

FS_PORTS=(8080 8081 8082 8083 8084)
FN_PORTS=(5001 5002 5003 5004 5005)
UI_PORTS=(4000 4001 4002 4003 4004)

if [ ! -f "$SERVICE_ACCOUNT" ]; then
  echo "Service account not found at $SERVICE_ACCOUNT" >&2
  exit 1
fi

run_combo() {
  local fs_port="$1"
  local fn_port="$2"
  local ui_port="$3"

  echo "→ Trying Firestore:$fs_port Functions:$fn_port UI:$ui_port"

  # Build a temp firebase config with overridden ports
  local tmp_config
  tmp_config="$(pwd)/.tmp.firebase.emu.$fs_port.json"

  # Merge existing firebase.json with port overrides via jq
  jq --argjson fs "$fs_port" \
     --argjson fn "$fn_port" \
     --argjson ui "$ui_port" \
     '.emulators.firestore.port = $fs
      | .emulators.functions.port = $fn
      | .emulators.ui.port = $ui' \
     firebase.json > "$tmp_config"

  FIRESTORE_EMULATOR_HOST="127.0.0.1:${fs_port}" \
  SERVICE_ACCOUNT="$SERVICE_ACCOUNT" \
  npx firebase emulators:exec \
    --only firestore,functions \
    --project "$PROJECT_ID" \
    --config "$tmp_config" \
    "node scripts/qa-vote-emulator-test.js"
}

for idx in "${!FS_PORTS[@]}"; do
  fs_port="${FS_PORTS[$idx]}"
  fn_port="${FN_PORTS[$idx]}"
  ui_port="${UI_PORTS[$idx]}"

  if run_combo "$fs_port" "$fn_port" "$ui_port"; then
    echo "✅ Voting emulator test succeeded on ports FS:$fs_port FN:$fn_port UI:$ui_port"
    exit 0
  else
    echo "⚠️  Combo FS:$fs_port FN:$fn_port UI:$ui_port failed, trying next..."
  fi
done

echo "❌ All port combinations failed. Check for occupied ports or emulator issues."
exit 1
