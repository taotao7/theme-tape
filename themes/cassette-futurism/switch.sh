#!/usr/bin/env bash
# Cassette Futurism Theme — Mode switcher
# Usage: ./switch.sh [dark|light|toggle]
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
  sed -i '' "s/^theme = .*/theme = dark:cassette-futurism-dark,light:cassette-futurism-light/" "$GHOSTTY_CONFIG" 2>/dev/null || true
  echo "  ✓ Ghostty → cassette-futurism-$MODE"
fi

# ── Tmux ──
if command -v tmux &>/dev/null && tmux list-sessions &>/dev/null; then
  tmux source-file "$HOME/.tmux.conf" 2>/dev/null || true
  if [ "$MODE" = "dark" ]; then
    tmux display-message " 📼 CASSETTE DARK"
  else
    tmux display-message " 📻 CASSETTE LIGHT"
  fi
  echo "  ✓ Tmux → cassette-futurism-$MODE"
fi

# ── Neovim (all running instances) ──
for sock in /tmp/nvim.*/0 "${XDG_RUNTIME_DIR:-/tmp}"/nvim.*/0; do
  [ -S "$sock" ] 2>/dev/null || continue
  nvim --server "$sock" --remote-send "<Cmd>lua require(\"cassette-futurism\").setup({ style = \"$MODE\" }) | set background=$MODE | colorscheme cassette-futurism<CR>" 2>/dev/null || true
done
echo "  ✓ Neovim → background=$MODE"

echo "Done! Now in $MODE mode."
