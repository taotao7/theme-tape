#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CURRENT_THEME="zenith"
if [ -f "$HOME/.tmux/theme_name" ] && [ -s "$HOME/.tmux/theme_name" ]; then
  CURRENT_THEME="$(cat "$HOME/.tmux/theme_name")"
fi

THEME_ARG="${1:-toggle}"
MODE_ARG="${2:-toggle}"

case "${1:-}" in
  dark|light)
    THEME_ARG="$CURRENT_THEME"
    MODE_ARG="$1"
    ;;
esac

if [ -x "$SCRIPT_DIR/dist/theme-tape" ]; then
  exec "$SCRIPT_DIR/dist/theme-tape" apply --theme "$THEME_ARG" --mode "$MODE_ARG"
fi

exec bun --cwd "$SCRIPT_DIR" run src/cli.tsx apply --theme "$THEME_ARG" --mode "$MODE_ARG"
