#!/usr/bin/env bash
# Zenith Theme — Install script
# Usage: ./install.sh [--all|--ghostty|--tmux|--nvim]
#   No args = --all
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST="$SCRIPT_DIR/dist"

install_ghostty() {
  echo "Installing Ghostty themes..."
  GHOSTTY_THEMES="${XDG_CONFIG_HOME:-$HOME/.config}/ghostty/themes"
  mkdir -p "$GHOSTTY_THEMES"
  ln -sf "$DIST/ghostty/zenith-dark"  "$GHOSTTY_THEMES/zenith-dark"
  ln -sf "$DIST/ghostty/zenith-light" "$GHOSTTY_THEMES/zenith-light"
  echo "  ✓ Themes → $GHOSTTY_THEMES"
  echo "  ℹ Config snippet: $DIST/ghostty/config-snippet"
  echo "    Append to ~/.config/ghostty/config (theme, font, opacity, blur)"
}

install_tmux() {
  echo "Installing Tmux themes..."
  TMUX_DIR="$HOME/.tmux/themes"
  mkdir -p "$TMUX_DIR"
  ln -sf "$DIST/tmux/zenith-dark.conf"  "$TMUX_DIR/zenith-dark.conf"
  ln -sf "$DIST/tmux/zenith-light.conf" "$TMUX_DIR/zenith-light.conf"
  echo "  ✓ Themes → $TMUX_DIR"

  # Truecolor passthrough snippet
  if [ -f "$DIST/tmux/truecolor.conf" ]; then
    ln -sf "$DIST/tmux/truecolor.conf" "$TMUX_DIR/truecolor.conf"
    echo "  ✓ Truecolor config → $TMUX_DIR/truecolor.conf"
  fi

  echo ""
  echo "  Add to ~/.tmux.conf:"
  echo '    source-file ~/.tmux/themes/truecolor.conf  # (optional, replaces xterm-256color)'
  echo "  Change theme loading line to:"
  echo '    if-shell "grep -q dark ~/.tmux/theme_state" \\'
  echo '      "source-file ~/.tmux/themes/zenith-dark.conf" \\'
  echo '      "source-file ~/.tmux/themes/zenith-light.conf"'
}

install_nvim() {
  echo "Installing Neovim plugin..."
  NVIM_SITE="${XDG_DATA_HOME:-$HOME/.local/share}/nvim/site/pack/zenith/start"
  mkdir -p "$NVIM_SITE"
  ln -sfn "$DIST/nvim/zenith.nvim" "$NVIM_SITE/zenith.nvim"
  echo "  ✓ Plugin → $NVIM_SITE/zenith.nvim"
  echo '  Add to init.lua: vim.cmd("colorscheme zenith")'
}

install_yazi() {
  echo "Installing Yazi theme..."
  YAZI_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/yazi"
  mkdir -p "$YAZI_DIR/flavors"
  cp -r "$DIST/yazi/flavors/zenith-dark.yazi"  "$YAZI_DIR/flavors/"
  cp -r "$DIST/yazi/flavors/zenith-light.yazi" "$YAZI_DIR/flavors/"
  cp    "$DIST/yazi/theme.toml"                "$YAZI_DIR/theme.toml"
  echo "  ✓ Flavors → $YAZI_DIR/flavors/zenith-{dark,light}.yazi/"
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

# Default: all
[ ${#COMPONENTS[@]} -eq 0 ] && COMPONENTS=("ghostty" "tmux" "nvim" "yazi")

echo "╭─ Zenith Theme Installer ─╮"
echo ""
for comp in "${COMPONENTS[@]}"; do
  install_"$comp"
  echo ""
done
echo "╰──────────────────────────╯"
