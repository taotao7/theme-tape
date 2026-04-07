#!/usr/bin/env bash
# Cassette Futurism Theme — Install script
# Usage: ./install.sh [--all|--ghostty|--tmux|--nvim|--yazi]
#   No args = --all
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST="$SCRIPT_DIR/dist"

install_ghostty() {
  echo "Installing Ghostty themes..."
  GHOSTTY_THEMES="${XDG_CONFIG_HOME:-$HOME/.config}/ghostty/themes"
  mkdir -p "$GHOSTTY_THEMES"
  ln -sf "$DIST/ghostty/cassette-futurism-dark"  "$GHOSTTY_THEMES/cassette-futurism-dark"
  ln -sf "$DIST/ghostty/cassette-futurism-light" "$GHOSTTY_THEMES/cassette-futurism-light"
  echo "  ✓ Themes → $GHOSTTY_THEMES"
  echo "  ℹ Config snippet: $DIST/ghostty/config-snippet"
  echo "    Append to ~/.config/ghostty/config (theme, font, opacity, blur)"
}

install_tmux() {
  echo "Installing Tmux themes..."
  TMUX_DIR="$HOME/.tmux/themes"
  mkdir -p "$TMUX_DIR"
  ln -sf "$DIST/tmux/cassette-futurism-dark.conf"  "$TMUX_DIR/cassette-futurism-dark.conf"
  ln -sf "$DIST/tmux/cassette-futurism-light.conf" "$TMUX_DIR/cassette-futurism-light.conf"
  echo "  ✓ Themes → $TMUX_DIR"

  if [ -f "$DIST/tmux/truecolor.conf" ]; then
    ln -sf "$DIST/tmux/truecolor.conf" "$TMUX_DIR/truecolor.conf"
    echo "  ✓ Truecolor config → $TMUX_DIR/truecolor.conf"
  fi

  echo ""
  echo "  Add to ~/.tmux.conf:"
  echo '    source-file ~/.tmux/themes/truecolor.conf  # (optional, replaces xterm-256color)'
  echo "  Change theme loading line to:"
  echo '    if-shell "grep -q dark ~/.tmux/theme_state" \\'
  echo '      "source-file ~/.tmux/themes/cassette-futurism-dark.conf" \\'
  echo '      "source-file ~/.tmux/themes/cassette-futurism-light.conf"'
}

install_nvim() {
  echo "Installing Neovim plugin..."
  NVIM_SITE="${XDG_DATA_HOME:-$HOME/.local/share}/nvim/site/pack/cassette-futurism/start"
  mkdir -p "$NVIM_SITE"
  ln -sfn "$DIST/nvim/cassette-futurism.nvim" "$NVIM_SITE/cassette-futurism.nvim"
  echo "  ✓ Plugin → $NVIM_SITE/cassette-futurism.nvim"
  echo '  Add to init.lua: vim.cmd("colorscheme cassette-futurism")'
}

install_yazi() {
  echo "Installing Yazi theme..."
  YAZI_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/yazi"
  mkdir -p "$YAZI_DIR/flavors"
  cp -r "$DIST/yazi/flavors/cassette-futurism-dark.yazi"  "$YAZI_DIR/flavors/"
  cp -r "$DIST/yazi/flavors/cassette-futurism-light.yazi" "$YAZI_DIR/flavors/"
  cp    "$DIST/yazi/theme.toml"                           "$YAZI_DIR/theme.toml"
  echo "  ✓ Flavors → $YAZI_DIR/flavors/cassette-futurism-{dark,light}.yazi/"
  echo "  ✓ Theme   → $YAZI_DIR/theme.toml (auto dark/light)"
  echo "  ℹ Chezmoi: chezmoi add ~/.config/yazi/theme.toml ~/.config/yazi/flavors/"
}

# Parse args
COMPONENTS=()
for arg in "$@"; do
  case "$arg" in
    --ghostty) COMPONENTS+=("ghostty") ;;
    --tmux)    COMPONENTS+=("tmux") ;;
    --nvim)    COMPONENTS+=("nvim") ;;
    --yazi)    COMPONENTS+=("yazi") ;;
    --all)     COMPONENTS=("ghostty" "tmux" "nvim" "yazi") ;;
    -h|--help)
      echo "Usage: $0 [--all|--ghostty|--tmux|--nvim|--yazi]"
      echo "  No args = install all components"
      exit 0 ;;
    *) echo "Unknown option: $arg"; exit 1 ;;
  esac
done

[ ${#COMPONENTS[@]} -eq 0 ] && COMPONENTS=("ghostty" "tmux" "nvim" "yazi")

echo "╭─ Cassette Futurism Theme Installer ─╮"
echo ""
for comp in "${COMPONENTS[@]}"; do
  install_"$comp"
  echo ""
done
echo "╰──────────────────────────────────────╯"
