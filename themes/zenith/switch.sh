#!/usr/bin/env bash
# Zenith Theme — Mode switcher
# Usage: ./switch.sh [dark|light|toggle]
# Integrates with tmux theme_state, ghostty config, and neovim
set -euo pipefail

TMUX_STATE="$HOME/.tmux/theme_state"

current() {
  cat "$TMUX_STATE" 2>/dev/null || echo "dark"
}

MODE="${1:-toggle}"
if [ "$MODE" = "toggle" ]; then
  [ "$(current)" = "dark" ] && MODE="light" || MODE="dark"
fi

if [ "$MODE" != "dark" ] && [ "$MODE" != "light" ]; then
  echo "Usage: $0 [dark|light|toggle]"
  exit 1
fi

echo "$MODE" > "$TMUX_STATE"

# ── Ghostty ──
GHOSTTY_CONFIG="${XDG_CONFIG_HOME:-$HOME/.config}/ghostty/config"
if [ -f "$GHOSTTY_CONFIG" ]; then
  sed -i '' "s/^theme = .*/theme = dark:zenith-dark,light:zenith-light/" "$GHOSTTY_CONFIG" 2>/dev/null || true
  echo "  ✓ Ghostty → zenith-$MODE"
fi

# ── Tmux ──
if command -v tmux &>/dev/null && tmux list-sessions &>/dev/null; then
  tmux source-file "$HOME/.tmux.conf" 2>/dev/null || true
  if [ "$MODE" = "dark" ]; then
    tmux display-message " 🌙 ZENITH DARK"
  else
    tmux display-message " ☀️  ZENITH LIGHT"
  fi
  echo "  ✓ Tmux → zenith-$MODE"
fi

# ── Neovim (all running instances) ──
for sock in /tmp/nvim.*/0 "${XDG_RUNTIME_DIR:-/tmp}"/nvim.*/0; do
  [ -S "$sock" ] 2>/dev/null || continue
  nvim --server "$sock" --remote-send "<Cmd>set background=$MODE<CR>" 2>/dev/null || true
done
echo "  ✓ Neovim → background=$MODE"

echo "Done! Now in $MODE mode."
