#!/bin/sh
set -eu

# Run the backup every $SCHEDULE_MINUTES minutes, forever.
# Requires NPUBS (comma-separated npubs / hex keys / nprofiles) to be set.
# Backups are written to $FOLDER (default /backup -- mount a named volume here).

if [ -z "${NPUBS:-}" ]; then
  echo "ERROR: NPUBS is not set. Provide one or more comma-separated npubs." >&2
  export
  exit 1
fi

interval="${SCHEDULE_MINUTES:-45}"

echo "nostr-backup daemon starting: running every ${interval} minute(s) for NPUBS=${NPUBS}"
echo "Output folder: ${FOLDER:-/backup}"

run_backup() {
  echo "===================================================================="
  echo "[$(date -Is)] starting backup run"
  node /app/bin/nostr-backup.js \
    --folder "${FOLDER:-/backup}" \
    ${RELAYS:+"--relays $RELAYS"} \
    ${EXTRA_GATEWAYS:+"--gateway $EXTRA_GATEWAYS"} \
    ${NPUBS}
  echo "[$(date -Is)] backup run finished (exit: $?)"
}

# Run once immediately, then on the schedule.
run_backup

while true; do
  sleep "$((interval * 60))"
  run_backup
done
