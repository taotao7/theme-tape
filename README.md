# theme-tape

`theme-tape` is a Bun + Ink TUI and CLI for managing the `cassette-futurism` and `zenith` themes across Ghostty, tmux, Neovim/AstroNvim, Yazi, opencode, and omp from one place.

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
- Managed config generation for Ghostty, tmux, Neovim/AstroNvim, Yazi, opencode, and omp
- Transparency control with `auto`, `transparent`, and `opaque` modes
- Omp installs both dark/light theme slots while preserving unrelated `config.yml` values and comments
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

For unreleased changes, run `./theme-tape` from this checkout after building. A Homebrew-installed `theme-tape` loads its bundled theme files, even when run inside this repository; `doctor` reports the active asset root.

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
theme-tape configure all  # ghostty | tmux | nvim | yazi | opencode | omp | all
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
- uses each theme's shared `palette.toml`, including Cassette's dark-mode accents, rather than a separate tmux palette
- on tmux 3.8+, synchronizes native UI colours with the selected theme; chooser selections use the palette's selection surface (`base.bg3`) and body text, while secondary labels use `text.fg_dim`, without inverting the theme's light/dark appearance; older tmux versions ignore the newer options
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

### omp (oh-my-pi)

- installs generated theme JSONs into omp's active agent directory `themes/`
- manages only `theme.dark` and `theme.light` in `config.yml`, preserving unrelated YAML values, nested fields, flow maps, and comments
- writes the selected theme family to both slots (`zenith-dark` + `zenith-light`, or `cassette-futurism-dark` + `cassette-futurism-light`); omp continues choosing the slot from the terminal background and can update while running
- resolves named profiles as `~/.omp/profiles/<OMP_PROFILE>/agent` (a named profile overrides `PI_CODING_AGENT_DIR`); `OMP_PROFILE` takes precedence over legacy `PI_PROFILE`, while the default uses `PI_CODING_AGENT_DIR` when set, otherwise `~/.omp/agent`
- `theme-tape config transparent|opaque|auto` does not rewrite omp root or panel backgrounds; omp's main canvas follows the terminal, while generated panel/status surfaces remain palette-controlled

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
- omp

## Development

```bash
bun run typecheck
bun run test
bun run build
```

Theme generators require Python 3.11 or newer; `theme-tape build` invokes `python3` for both theme directories.

## License

MIT
