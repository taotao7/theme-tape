#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ -x "$SCRIPT_DIR/dist/theme-tape" ]; then
  exec "$SCRIPT_DIR/dist/theme-tape" apply --theme "${1:-toggle}" --mode "${2:-toggle}"
fi

exec bun --cwd "$SCRIPT_DIR" run src/cli.tsx apply --theme "${1:-toggle}" --mode "${2:-toggle}"
