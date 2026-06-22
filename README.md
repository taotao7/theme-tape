# theme-tape

`theme-tape` is a Bun + Ink TUI and CLI for managing the `cassette-futurism` and `zenith` themes across Ghostty, tmux, Neovim/AstroNvim, Yazi, and opencode from one place.

## Preview

| Cassette Futurism | Zenith |
| --- | --- |
| ![Cassette Futurism preview](https://raw.githubusercontent.com/taotao7/cassette-futurism/main/assets/preview.png) | ![Zenith preview](https://raw.githubusercontent.com/taotao7/zenith-theme/main/assets/preview.png) |

Source image URLs:

- `https://raw.githubusercontent.com/taotao7/cassette-futurism/main/assets/preview.png`
- `https://raw.githubusercontent.com/taotao7/zenith-theme/main/assets/preview.png`

## Features

- One manager for both themes
- Interactive TUI plus scriptable CLI
- Dark, light, and toggle mode switching
- Managed config generation for Ghostty, tmux, Neovim/AstroNvim, Yazi, and opencode
- Transparency control with `auto`, `transparent`, and `opaque` modes
- `doctor` output for real asset paths, install paths, and detected config locations
- Manifest-based theme discovery for adding more themes later

## Install

### Homebrew

```bash
brew install taotao7/tap/theme-tape
```

### From source

```bash
bun install
bun run build
./dist/theme-tape --help
```

## Quick start

Launch the TUI:

```bash
theme-tape
```

Install theme assets and write managed config:

```bash
theme-tape install --theme all --components all
theme-tape configure all
```

Apply a theme:

```bash
theme-tape apply --theme zenith --mode dark
theme-tape apply --theme cassette-futurism --mode light
theme-tape apply --theme toggle --mode toggle
```

Inspect the current setup:

```bash
theme-tape state
theme-tape doctor
```

Control transparency:

```bash
theme-tape config auto
theme-tape config transparent
theme-tape config opaque
```

## Commands

```bash
theme-tape                 # launch the Ink TUI
theme-tape state          # print persisted theme + mode
theme-tape doctor         # print detected paths and install status
theme-tape build          # regenerate theme outputs
theme-tape config MODE    # auto | transparent | opaque
theme-tape configure all  # ghostty | tmux | nvim | yazi | all
theme-tape install --theme all --components all
theme-tape apply --theme zenith --mode dark
```

## Managed integrations

### Ghostty

- installs theme files into `~/.config/ghostty/themes`
- updates `~/.config/ghostty/config`
- applies opacity and blur based on `theme-tape config`

### tmux

- installs theme files into `~/.tmux/themes`
- manages `~/.tmux/theme-tape.conf`
- keeps state in:
  - `~/.tmux/theme_state`
  - `~/.tmux/theme_name`

### Neovim / AstroNvim

- installs themes into `~/.local/share/nvim/site/pack/theme-tape/start`
- detects standard Neovim vs AstroNvim automatically
- writes a managed plugin file
- AstroNvim integration can sync with `f-person/auto-dark-mode.nvim`

### Yazi

- installs flavors into `~/.config/yazi/flavors`
- manages `~/.config/yazi/theme.toml`

### opencode

- installs theme JSONs into `~/.config/opencode/themes`
- manages `~/.config/opencode/tui.json`
- in `auto` transparency mode, keeps light OpenCode themes opaque and makes dark OpenCode themes transparent
- explicit `theme-tape config transparent` sets `background`/`backgroundPanel` to `"none"`, while keeping elevated `backgroundElement`/`backgroundMenu` colors so floating overlays like the Ctrl+P picker stay readable
- OpenCode needs terminal truecolor for the full palette; if colors look crushed, check that `echo $COLORTERM` prints `truecolor` or `24bit`

## Codex (OpenAI Codex app)

The Codex desktop app can import a theme from a `codex-theme-v1:` string. Paste one of the strings below into Codex's theme importer to get the `cassette-futurism` palette.

> [!NOTE]
> Codex currently validates `codeThemeId` against its built-in syntax-highlight themes, so a custom id like `cassette-futurism` is rejected and the **Import theme** button stays disabled ([openai/codex#14766](https://github.com/openai/codex/issues/14766)). The strings below therefore use `gruvbox` as `codeThemeId` (closest retro/beige highlight set). This only affects code syntax highlighting — the window `surface`/`ink`/`accent`/diff colors are all the cassette-futurism palette. Swap `gruvbox` for `everforest` or any built-in id if you prefer a different highlight base.

**Light — "Beige Terminal"**

```
codex-theme-v1:{"codeThemeId":"gruvbox","theme":{"accent":"#d65d0e","contrast":45,"fonts":{"code":"Iosevka Nerd Font Mono","ui":null},"ink":"#2d2a27","opaqueWindows":false,"semanticColors":{"diffAdded":"#458588","diffRemoved":"#9d0006","skill":"#b16286"},"surface":"#f5f0e8"},"variant":"light"}
```

**Dark — "Magnetic Night"**

```
codex-theme-v1:{"codeThemeId":"gruvbox","theme":{"accent":"#ffb86c","contrast":45,"fonts":{"code":"Iosevka Nerd Font Mono","ui":null},"ink":"#d4d4d4","opaqueWindows":false,"semanticColors":{"diffAdded":"#50fa7b","diffRemoved":"#ff5555","skill":"#ff79c6"},"surface":"#1a1d21"},"variant":"dark"}
```

Colors are sourced from `themes/cassette-futurism/palette.toml`: `surface`←base bg, `ink`←text fg, `accent`←the amber/orange glow, `diffAdded`/`diffRemoved`←git add/delete, `skill`←pink/purple accent.

## Adding themes

Themes are discovered from `themes/*/theme.json`. Each theme directory can ship assets for:

- Ghostty
- tmux
- Neovim
- Yazi
- opencode

This keeps the manager extensible without hardcoding every theme in the CLI.

## Development

```bash
bun run typecheck
bun run test
bun run build
```

## License

MIT
