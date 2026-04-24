#!/usr/bin/env python3
"""Zenith Theme Generator

Reads palette.toml and generates unified configs for:
  - Ghostty terminal (theme files)
  - Tmux (status bar + colors)
  - Neovim (Lua colorscheme plugin)
"""

import tomllib
import json
import os
import textwrap
from pathlib import Path

ROOT = Path(__file__).parent
DIST = ROOT / "dist"


def load_palette() -> dict:
    with open(ROOT / "palette.toml", "rb") as f:
        return tomllib.load(f)


def resolve(palette: dict, path: str) -> str:
    """Resolve a dotted path like 'accent.red' against a mode palette."""
    obj = palette
    for key in path.split("."):
        obj = obj[key]
    return obj


def resolve_ansi(palette: dict, ansi_map: dict, mode: str) -> dict[int, str]:
    """Resolve ANSI 0-15 colors for a given mode."""
    mode_pal = palette[mode]
    result = {}
    for i in range(16):
        path = ansi_map[f"color{i}"]
        result[i] = resolve(mode_pal, path)
    return result


# ─── Ghostty ───────────────────────────────────────────────────────


def gen_ghostty(palette: dict, mode: str) -> str:
    p = palette[mode]
    ansi = resolve_ansi(palette, palette["ansi_map"], mode)
    lines = [
        f"# Zenith {mode.title()} — Ghostty Theme",
        f"# Generated from palette.toml",
        "",
        f"background = {p['base']['bg']}",
        f"foreground = {p['text']['fg']}",
        f"cursor-color = {p['accent']['purple']}",
        f"cursor-text = {p['base']['bg']}",
        f"selection-background = {p['base']['bg3']}",
        f"selection-foreground = {p['text']['fg']}",
        "",
    ]
    for i in range(16):
        lines.append(f"palette = {i}={ansi[i]}")
    return "\n".join(lines) + "\n"


def gen_ghostty_snippet(palette: dict) -> str:
    """Ghostty config snippet for font, opacity, blur, etc."""
    return textwrap.dedent("""\
        # Zenith — Ghostty config snippet
        # Append to ~/.config/ghostty/config

        # Theme (switch between dark/light)
        theme = zenith-dark
        # theme = zenith-light

        # Font — research recommends JetBrains Mono Nerd Font
        font-family = "JetBrainsMono Nerd Font"
        font-size = 16
        font-thicken = true

        # Visual ergonomics: glass effect (0.85-0.95 sweet spot)
        background-opacity = 0.92
        background-blur-radius = 20
        # macOS native glass (alternative):
        # background-blur = macos-glass-regular

        # Cursor
        cursor-style = bar
        cursor-style-blink = false

        # Window
        window-padding-x = 8
        window-padding-y = 4
        window-decoration = false
        macos-titlebar-style = hidden
    """)


# ─── Tmux ──────────────────────────────────────────────────────────
# Generates theme files compatible with user's existing tmux.conf
# Uses @tape_* variable convention so it drops in seamlessly


def gen_tmux(palette: dict, mode: str) -> str:
    """Generate tmux theme file using @tape_* variables.

    Compatible with existing tmux.conf that references #{@tape_*}
    for status bar, pane borders, plugins, etc.
    """
    p = palette[mode]

    # Map palette to @tape_* variables
    # Dark mode: bg=default (transparent), light mode: solid bg
    if mode == "dark":
        tape_bg = "default"
        tape_active_bg = "#{@tape_cyan}"
        tape_active_fg = "#{@tape_dark}"
    else:
        tape_bg = p["base"]["bg"]
        tape_active_bg = "#{@tape_orange}"
        tape_active_fg = "#{@tape_bg}"

    return textwrap.dedent(f"""\
        # --- Zenith: {mode.title()} Mode ---
        # Generated from palette.toml
        # Compatible with @tape_* variable convention

        # ── Palette Variables ──
        set -g @tape_bg "{tape_bg}"
        set -g @tape_fg "{p['text']['fg']}"
        set -g @tape_red "{p['accent']['red']}"
        set -g @tape_orange "{p['accent']['orange']}"
        set -g @tape_yellow "{p['accent']['yellow']}"
        set -g @tape_green "{p['accent']['green']}"
        set -g @tape_cyan "{p['accent']['cyan']}"
        set -g @tape_blue "{p['accent']['blue']}"
        set -g @tape_purple "{p['accent']['purple']}"
        set -g @tape_pink "{p['accent']['pink']}"
        set -g @tape_gray "{p['text']['comment']}"
        set -g @tape_dark "{p['base']['bg1']}"
        set -g @tape_void "{p['base']['bg']}"
        set -g @tape_active_bg "{tape_active_bg}"
        set -g @tape_active_fg "{tape_active_fg}"

        # ── Force Refresh Styles ──
        set -g status-style "bg={tape_bg},fg=#{{@tape_fg}}"
        set -g window-status-activity-style "fg=#{{@tape_orange}},bold"
        set -g window-status-bell-style "fg=#{{@tape_red}},bold,blink"
        set -g mode-style "bg=#{{@tape_cyan}},fg=#{{@tape_dark}},bold"
        set -g message-style "bg=#{{@tape_dark}},fg=#{{@tape_cyan}},border-style=double"
        set -g message-command-style "bg=#{{@tape_dark}},fg=#{{@tape_orange}}"
        setw -g pane-active-border-style "fg=#{{@tape_cyan}},bg=default"
        setw -g pane-border-style "fg=#{{@tape_gray}},bg=default"

        # Copy mode styling
        setw -g mode-style "bg=#{{@tape_cyan}},fg=#{{@tape_dark}},bold"
    """)


def gen_tmux_truecolor() -> str:
    """Generate tmux truecolor + undercurl passthrough config.

    This is separate from theme files — add to tmux.conf once.
    Safe to re-source: first entry uses set -g to reset overrides.
    """
    return textwrap.dedent("""\
        # Zenith — Truecolor & Undercurl Passthrough
        # Source this in tmux.conf for proper color rendering
        # Replaces: set -g default-terminal "xterm-256color"
        # Safe to re-source: first entry uses set -g to reset overrides

        set -g  default-terminal "tmux-256color"
        set -g  terminal-overrides "linux*:AX@,*256col*:RGB"
        set -as terminal-overrides ",*:Tc"
        set -as terminal-overrides ',*:sitm=\\E[3m'
        set -as terminal-overrides ',*:Smulx=\\E[4::%p1%dm'
        set -as terminal-overrides ',*:Setulc=\\E[58::2::%p1%{65536}%/%d::%p1%{256}%/%{255}%&%d::%p1%{255}%&%d%;m'
    """)


# ─── Yazi ─────────────────────────────────────────────────────────


def gen_yazi(palette: dict, mode: str) -> str:
    """Generate Yazi theme.toml for the given mode."""
    p = palette[mode]
    b = p["base"]
    t = p["text"]
    a = p["accent"]
    d = p["diagnostic"]

    return textwrap.dedent(f"""\
        # Zenith {mode.title()} — Yazi Flavor
        # Generated from palette.toml

        [mgr]
        cwd             = {{ fg = "{a['cyan']}" }}
        find_keyword    = {{ fg = "{a['yellow']}", bold = true, italic = true }}
        find_position   = {{ fg = "{a['purple']}", bg = "reset", italic = true }}
        symlink_target  = {{ fg = "{a['cyan']}", italic = true }}
        marker_selected = {{ fg = "{b['bg']}", bg = "{a['green']}" }}
        marker_copied   = {{ fg = "{b['bg']}", bg = "{a['yellow']}" }}
        marker_cut      = {{ fg = "{b['bg']}", bg = "{a['red']}" }}
        marker_marked   = {{ fg = "{b['bg']}", bg = "{a['cyan']}" }}
        count_selected  = {{ fg = "{a['green']}", bg = "{b['bg1']}" }}
        count_copied    = {{ fg = "{a['yellow']}", bg = "{b['bg1']}" }}
        count_cut       = {{ fg = "{a['red']}", bg = "{b['bg1']}" }}
        border_symbol   = "│"
        border_style    = {{ fg = "{b['border']}" }}

        [app]
        overall = {{ bg = "reset" }}

        [tabs]
        active   = {{ fg = "{t['fg']}", bg = "{b['bg2']}", bold = true }}
        inactive = {{ fg = "{t['comment']}", bg = "reset" }}

        [indicator]
        parent  = {{ fg = "{t['comment']}", bg = "reset" }}
        current = {{ fg = "{t['fg']}", bg = "{b['bg2']}", bold = true }}
        preview = {{ fg = "{t['comment']}", bg = "reset" }}

        [mode]
        normal_main = {{ fg = "{b['bg']}", bg = "{a['blue']}", bold = true }}
        normal_alt  = {{ fg = "{a['blue']}", bg = "reset" }}
        select_main = {{ fg = "{b['bg']}", bg = "{a['green']}", bold = true }}
        select_alt  = {{ fg = "{a['green']}", bg = "reset" }}
        unset_main  = {{ fg = "{b['bg']}", bg = "{a['orange']}", bold = true }}
        unset_alt   = {{ fg = "{a['orange']}", bg = "reset" }}

        [status]
        overall        = {{ bg = "reset" }}
        perm_type      = {{ fg = "{a['blue']}" }}
        perm_read      = {{ fg = "{a['yellow']}" }}
        perm_write     = {{ fg = "{a['red']}" }}
        perm_exec      = {{ fg = "{a['green']}" }}
        perm_sep       = {{ fg = "{t['comment']}" }}
        progress_label  = {{ fg = "{t['fg']}", bold = true }}
        progress_normal = {{ fg = "{a['blue']}" }}
        progress_error  = {{ fg = "{d['error']}" }}

        [which]
        cols            = 3
        mask            = {{ bg = "reset" }}
        cand            = {{ fg = "{a['cyan']}" }}
        rest            = {{ fg = "{t['comment']}" }}
        desc            = {{ fg = "{t['fg']}" }}
        separator       = "  "
        separator_style = {{ fg = "{b['border']}" }}

        [confirm]
        border  = {{ fg = "{b['border']}" }}
        title   = {{ fg = "{a['purple']}" }}
        body    = {{ fg = "{t['fg']}" }}
        list    = {{ fg = "{t['fg_dim']}" }}
        btn_yes = {{ fg = "{b['bg']}", bg = "{a['green']}", bold = true }}
        btn_no  = {{ fg = "{b['bg']}", bg = "{a['red']}", bold = true }}

        [spot]
        border   = {{ fg = "{b['border']}" }}
        title    = {{ fg = "{a['purple']}" }}
        tbl_col  = {{ fg = "{a['cyan']}", bold = true }}
        tbl_cell = {{ fg = "{t['fg']}" }}

        [notify]
        title_info  = {{ fg = "{a['cyan']}" }}
        title_warn  = {{ fg = "{d['warn']}" }}
        title_error = {{ fg = "{d['error']}" }}

        [pick]
        border   = {{ fg = "{b['border']}" }}
        active   = {{ fg = "{b['bg']}", bg = "{a['blue']}", bold = true }}
        inactive = {{ fg = "{t['fg_dim']}" }}

        [input]
        border   = {{ fg = "{b['border']}" }}
        title    = {{ fg = "{a['purple']}" }}
        value    = {{ fg = "{t['fg']}" }}
        selected = {{ fg = "{b['bg']}", bg = "{a['blue']}" }}

        [cmp]
        border   = {{ fg = "{b['border']}" }}
        active   = {{ fg = "{b['bg']}", bg = "{a['blue']}", bold = true }}
        inactive = {{ fg = "{t['fg_dim']}" }}

        [tasks]
        border  = {{ fg = "{b['border']}" }}
        title   = {{ fg = "{a['purple']}" }}
        hovered = {{ fg = "{t['fg']}", underline = true }}

        [help]
        on      = {{ fg = "{a['cyan']}" }}
        run     = {{ fg = "{a['purple']}" }}
        desc    = {{ fg = "{t['fg']}" }}
        hovered = {{ reversed = true, bold = true }}
        footer  = {{ fg = "{b['bg']}", bg = "{t['comment']}" }}

        [filetype]
        rules = [
          {{ mime = "image/*",                      fg = "{a['pink']}" }},
          {{ mime = "video/*",                      fg = "{a['purple']}" }},
          {{ mime = "audio/*",                      fg = "{a['cyan']}" }},
          {{ mime = "application/zip",              fg = "{a['orange']}" }},
          {{ mime = "application/gzip",             fg = "{a['orange']}" }},
          {{ mime = "application/x-tar",            fg = "{a['orange']}" }},
          {{ mime = "application/x-bzip2",          fg = "{a['orange']}" }},
          {{ mime = "application/x-7z-compressed",  fg = "{a['orange']}" }},
          {{ mime = "application/x-rar",            fg = "{a['orange']}" }},
          {{ mime = "application/pdf",              fg = "{a['red']}" }},
          {{ name = "*", is = "exec",               fg = "{a['green']}" }},
          {{ name = "*", is = "orphan",             fg = "{d['error']}", underline = true }},
          {{ name = "*", is = "link",               fg = "{a['cyan']}" }},
          {{ name = "*/",                           fg = "{a['blue']}" }},
          {{ name = "*",                            fg = "{t['fg']}" }},
        ]
    """)


def gen_yazi_theme_pointer() -> str:
    """Generate theme.toml — auto dark/light via Yazi flavor system."""
    return textwrap.dedent("""\
        # Zenith — Yazi Theme
        # Auto-switches between dark/light based on system appearance.

        [flavor]
        dark  = "zenith-dark"
        light = "zenith-light"
    """)


# ─── Neovim ───────────────────────────────────────────────────────


def gen_nvim_palette(palette: dict) -> str:
    """Generate lua/zenith/palette.lua"""
    def fmt_table(p: dict, indent: int = 2) -> str:
        lines = []
        sp = " " * indent
        for section in ("base", "text", "accent", "diagnostic", "git"):
            if section not in p:
                continue
            lines.append(f"{sp}{section} = {{")
            for k, v in p[section].items():
                lines.append(f'{sp}  {k} = "{v}",')
            lines.append(f"{sp}}},")
        return "\n".join(lines)

    return textwrap.dedent(f"""\
        -- Zenith palette (generated from palette.toml)
        local M = {{}}

        M.dark = {{
        {fmt_table(palette['dark'])}
        }}

        M.light = {{
        {fmt_table(palette['light'])}
        }}

        return M
    """)


def gen_nvim_theme() -> str:
    """Generate lua/zenith/theme.lua — highlight group definitions."""
    return textwrap.dedent("""\
        -- Zenith highlight groups (generated)
        local M = {}

        function M.setup(p, config)
          local set = vim.api.nvim_set_hl

          -- ── Editor UI ──
          set(0, "Normal",           { fg = p.text.fg, bg = config.transparent and "NONE" or p.base.bg })
          set(0, "NormalNC",         { fg = config.dim_inactive and p.text.comment or p.text.fg, bg = config.transparent and "NONE" or (config.dim_inactive and p.base.bg_dim or p.base.bg) })
          set(0, "NormalFloat",      { fg = p.text.fg, bg = p.base.bg2 })
          set(0, "FloatBorder",      { fg = p.base.border, bg = p.base.bg2 })
          set(0, "FloatTitle",       { fg = p.accent.purple, bg = p.base.bg2, bold = true })
          set(0, "Cursor",           { fg = p.base.bg, bg = p.accent.purple })
          set(0, "CursorLine",       { bg = p.base.bg4 })
          set(0, "CursorLineNr",     { fg = p.accent.purple, bold = true })
          set(0, "CursorColumn",     { bg = p.base.bg4 })
          set(0, "LineNr",           { fg = p.text.comment })
          set(0, "SignColumn",       { bg = "NONE" })
          set(0, "FoldColumn",       { fg = p.text.comment })
          set(0, "Folded",           { fg = p.text.comment, bg = p.base.bg1 })
          set(0, "VertSplit",        { fg = p.base.border })
          set(0, "WinSeparator",     { fg = p.base.border })
          set(0, "StatusLine",       { fg = p.text.fg_dim, bg = p.base.bg1 })
          set(0, "StatusLineNC",     { fg = p.text.comment, bg = p.base.bg_dim })
          set(0, "WinBar",           { fg = p.text.fg_dim, bg = "NONE" })
          set(0, "WinBarNC",         { fg = p.text.comment, bg = "NONE" })
          set(0, "TabLine",          { fg = p.text.comment, bg = p.base.bg1 })
          set(0, "TabLineFill",      { bg = p.base.bg })
          set(0, "TabLineSel",       { fg = p.accent.purple, bg = p.base.bg, bold = true })
          set(0, "Pmenu",            { fg = p.text.fg, bg = p.base.bg2 })
          set(0, "PmenuSel",         { fg = p.base.bg, bg = p.accent.blue })
          set(0, "PmenuSbar",        { bg = p.base.bg3 })
          set(0, "PmenuThumb",       { bg = p.accent.purple })
          set(0, "Visual",           { bg = p.base.bg3 })
          set(0, "VisualNOS",        { bg = p.base.bg3 })
          set(0, "Search",           { fg = p.base.bg, bg = p.accent.yellow })
          set(0, "IncSearch",        { fg = p.base.bg, bg = p.accent.orange })
          set(0, "CurSearch",        { fg = p.base.bg, bg = p.accent.purple })
          set(0, "Substitute",       { fg = p.base.bg, bg = p.accent.red })
          set(0, "MatchParen",       { fg = p.accent.yellow, bold = true, underline = true })
          set(0, "NonText",          { fg = p.base.border })
          set(0, "Whitespace",       { fg = p.base.border })
          set(0, "SpecialKey",       { fg = p.base.border })
          set(0, "Directory",        { fg = p.accent.blue })
          set(0, "Title",            { fg = p.accent.purple, bold = true })
          set(0, "ErrorMsg",         { fg = p.diagnostic.error })
          set(0, "WarningMsg",       { fg = p.diagnostic.warn })
          set(0, "MoreMsg",          { fg = p.accent.cyan })
          set(0, "Question",         { fg = p.accent.cyan })
          set(0, "WildMenu",         { fg = p.base.bg, bg = p.accent.blue })
          set(0, "Conceal",          { fg = p.text.comment })
          set(0, "SpellBad",         { sp = p.diagnostic.error, undercurl = true })
          set(0, "SpellCap",         { sp = p.diagnostic.warn, undercurl = true })
          set(0, "SpellLocal",       { sp = p.diagnostic.info, undercurl = true })
          set(0, "SpellRare",        { sp = p.diagnostic.hint, undercurl = true })

          -- ── Syntax (legacy vim groups, linked by Treesitter) ──
          set(0, "Comment",          { fg = p.text.comment, italic = true })
          set(0, "Constant",         { fg = p.accent.orange })
          set(0, "String",           { fg = p.accent.green })
          set(0, "Character",        { fg = p.accent.green })
          set(0, "Number",           { fg = p.accent.orange })
          set(0, "Boolean",          { fg = p.accent.orange })
          set(0, "Float",            { fg = p.accent.orange })
          set(0, "Identifier",       { fg = p.text.fg })
          set(0, "Function",         { fg = p.accent.blue })
          set(0, "Statement",        { fg = p.accent.purple })
          set(0, "Conditional",      { fg = p.accent.purple })
          set(0, "Repeat",           { fg = p.accent.purple })
          set(0, "Label",            { fg = p.accent.cyan })
          set(0, "Operator",         { fg = p.accent.pink })
          set(0, "Keyword",          { fg = p.accent.purple })
          set(0, "Exception",        { fg = p.accent.purple })
          set(0, "PreProc",          { fg = p.accent.pink })
          set(0, "Include",          { fg = p.accent.pink })
          set(0, "Define",           { fg = p.accent.pink })
          set(0, "Macro",            { fg = p.accent.pink })
          set(0, "PreCondit",        { fg = p.accent.pink })
          set(0, "Type",             { fg = p.accent.yellow })
          set(0, "StorageClass",     { fg = p.accent.yellow })
          set(0, "Structure",        { fg = p.accent.yellow })
          set(0, "Typedef",          { fg = p.accent.yellow })
          set(0, "Special",          { fg = p.accent.pink })
          set(0, "SpecialChar",      { fg = p.accent.pink })
          set(0, "Tag",              { fg = p.accent.cyan })
          set(0, "Delimiter",        { fg = p.text.fg_dim })
          set(0, "SpecialComment",   { fg = p.text.comment, italic = true })
          set(0, "Debug",            { fg = p.accent.red })
          set(0, "Underlined",       { underline = true })
          set(0, "Error",            { fg = p.diagnostic.error })
          set(0, "Todo",             { fg = p.accent.yellow, bold = true })

          -- ── Treesitter (@captures) ──
          -- Skeleton anchors: high-visibility keywords
          set(0, "@keyword",                { fg = p.accent.purple })
          set(0, "@keyword.conditional",    { fg = p.accent.purple })
          set(0, "@keyword.repeat",         { fg = p.accent.purple })
          set(0, "@keyword.return",         { fg = p.accent.purple })
          set(0, "@keyword.function",       { fg = p.accent.purple })
          set(0, "@keyword.operator",       { fg = p.accent.pink })
          set(0, "@keyword.import",         { fg = p.accent.pink })
          set(0, "@keyword.exception",      { fg = p.accent.purple })

          -- Structure: functions, types
          set(0, "@function",               { fg = p.accent.blue })
          set(0, "@function.call",          { fg = p.accent.blue })
          set(0, "@function.builtin",       { fg = p.accent.cyan })
          set(0, "@function.method",        { fg = p.accent.blue })
          set(0, "@function.method.call",   { fg = p.accent.blue })
          set(0, "@constructor",            { fg = p.accent.yellow })
          set(0, "@type",                   { fg = p.accent.yellow })
          set(0, "@type.builtin",           { fg = p.accent.yellow, italic = true })
          set(0, "@type.definition",        { fg = p.accent.yellow })

          -- Texture fill: variables, parameters (lower contrast)
          set(0, "@variable",               { fg = p.text.fg })
          set(0, "@variable.builtin",       { fg = p.accent.cyan, italic = true })
          set(0, "@variable.parameter",     { fg = p.accent.cyan })
          set(0, "@variable.member",        { fg = p.text.fg })
          set(0, "@property",               { fg = p.text.fg })
          set(0, "@constant",               { fg = p.accent.orange })
          set(0, "@constant.builtin",       { fg = p.accent.orange, italic = true })

          -- Literals
          set(0, "@string",                 { fg = p.accent.green })
          set(0, "@string.escape",          { fg = p.accent.pink })
          set(0, "@string.regex",           { fg = p.accent.pink })
          set(0, "@string.special",         { fg = p.accent.pink })
          set(0, "@character",              { fg = p.accent.green })
          set(0, "@number",                 { fg = p.accent.orange })
          set(0, "@boolean",                { fg = p.accent.orange })

          -- Noise reduction: comments, punctuation
          set(0, "@comment",                { fg = p.text.comment, italic = true })
          set(0, "@comment.documentation",  { fg = p.text.comment, italic = true })
          set(0, "@comment.todo",           { fg = p.accent.yellow, bold = true })
          set(0, "@comment.note",           { fg = p.accent.cyan, bold = true })
          set(0, "@comment.warning",        { fg = p.diagnostic.warn, bold = true })
          set(0, "@comment.error",          { fg = p.diagnostic.error, bold = true })
          set(0, "@punctuation.bracket",    { fg = p.text.fg_dim })
          set(0, "@punctuation.delimiter",  { fg = p.text.fg_dim })
          set(0, "@punctuation.special",    { fg = p.accent.pink })

          -- Markup, tags
          set(0, "@tag",                    { fg = p.accent.red })
          set(0, "@tag.attribute",          { fg = p.accent.yellow, italic = true })
          set(0, "@tag.delimiter",          { fg = p.text.fg_dim })
          set(0, "@attribute",              { fg = p.accent.yellow })
          set(0, "@module",                 { fg = p.accent.cyan })
          set(0, "@label",                  { fg = p.accent.cyan })
          set(0, "@operator",              { fg = p.accent.pink })

          -- ── LSP Semantic Tokens ──
          set(0, "@lsp.type.namespace",     { link = "@module" })
          set(0, "@lsp.type.type",          { link = "@type" })
          set(0, "@lsp.type.class",         { link = "@type" })
          set(0, "@lsp.type.enum",          { link = "@type" })
          set(0, "@lsp.type.interface",     { link = "@type" })
          set(0, "@lsp.type.struct",        { link = "@type" })
          set(0, "@lsp.type.parameter",     { link = "@variable.parameter" })
          set(0, "@lsp.type.property",      { link = "@property" })
          set(0, "@lsp.type.function",      { link = "@function" })
          set(0, "@lsp.type.method",        { link = "@function.method" })
          set(0, "@lsp.type.macro",         { link = "Macro" })
          set(0, "@lsp.type.decorator",     { link = "@attribute" })
          set(0, "@lsp.mod.deprecated",     { strikethrough = true })

          -- ── Diagnostics ──
          set(0, "DiagnosticError",          { fg = p.diagnostic.error })
          set(0, "DiagnosticWarn",           { fg = p.diagnostic.warn })
          set(0, "DiagnosticInfo",           { fg = p.diagnostic.info })
          set(0, "DiagnosticHint",           { fg = p.diagnostic.hint })
          set(0, "DiagnosticUnderlineError", { sp = p.diagnostic.error, undercurl = true })
          set(0, "DiagnosticUnderlineWarn",  { sp = p.diagnostic.warn, undercurl = true })
          set(0, "DiagnosticUnderlineInfo",  { sp = p.diagnostic.info, undercurl = true })
          set(0, "DiagnosticUnderlineHint",  { sp = p.diagnostic.hint, undercurl = true })
          set(0, "DiagnosticVirtualTextError", { fg = p.diagnostic.error, bg = p.base.bg1 })
          set(0, "DiagnosticVirtualTextWarn",  { fg = p.diagnostic.warn, bg = p.base.bg1 })
          set(0, "DiagnosticVirtualTextInfo",  { fg = p.diagnostic.info, bg = p.base.bg1 })
          set(0, "DiagnosticVirtualTextHint",  { fg = p.diagnostic.hint, bg = p.base.bg1 })

          -- ── Git Signs ──
          set(0, "GitSignsAdd",              { fg = p.git.add })
          set(0, "GitSignsChange",           { fg = p.git.change })
          set(0, "GitSignsDelete",           { fg = p.git.delete })
          set(0, "GitSignsAddNr",            { fg = p.git.add })
          set(0, "GitSignsChangeNr",         { fg = p.git.change })
          set(0, "GitSignsDeleteNr",         { fg = p.git.delete })

          -- ── Diff ──
          set(0, "DiffAdd",                  { bg = p.base.bg1, fg = p.git.add })
          set(0, "DiffChange",               { bg = p.base.bg1, fg = p.git.change })
          set(0, "DiffDelete",               { bg = p.base.bg1, fg = p.git.delete })
          set(0, "DiffText",                 { bg = p.base.bg3 })

          -- ── Telescope ──
          set(0, "TelescopeNormal",          { fg = p.text.fg, bg = p.base.bg1 })
          set(0, "TelescopeBorder",          { fg = p.base.border, bg = p.base.bg1 })
          set(0, "TelescopePromptNormal",    { fg = p.text.fg, bg = p.base.bg2 })
          set(0, "TelescopePromptBorder",    { fg = p.base.bg2, bg = p.base.bg2 })
          set(0, "TelescopePromptTitle",     { fg = p.base.bg, bg = p.accent.purple, bold = true })
          set(0, "TelescopePreviewTitle",    { fg = p.base.bg, bg = p.accent.blue, bold = true })
          set(0, "TelescopeResultsTitle",    { fg = p.base.bg, bg = p.accent.cyan, bold = true })
          set(0, "TelescopeSelection",       { bg = p.base.bg3 })
          set(0, "TelescopeMatching",        { fg = p.accent.purple, bold = true })

          -- ── nvim-cmp ──
          set(0, "CmpItemAbbr",              { fg = p.text.fg })
          set(0, "CmpItemAbbrMatch",         { fg = p.accent.purple, bold = true })
          set(0, "CmpItemAbbrMatchFuzzy",    { fg = p.accent.purple, bold = true })
          set(0, "CmpItemAbbrDeprecated",    { fg = p.text.comment, strikethrough = true })
          set(0, "CmpItemKindFunction",      { fg = p.accent.blue })
          set(0, "CmpItemKindMethod",        { fg = p.accent.blue })
          set(0, "CmpItemKindVariable",      { fg = p.accent.cyan })
          set(0, "CmpItemKindKeyword",       { fg = p.accent.purple })
          set(0, "CmpItemKindText",          { fg = p.text.fg_dim })
          set(0, "CmpItemKindSnippet",       { fg = p.accent.yellow })
          set(0, "CmpItemKindClass",         { fg = p.accent.yellow })
          set(0, "CmpItemKindInterface",     { fg = p.accent.yellow })
          set(0, "CmpItemKindModule",        { fg = p.accent.cyan })
          set(0, "CmpItemKindProperty",      { fg = p.text.fg })
          set(0, "CmpItemKindField",         { fg = p.text.fg })
          set(0, "CmpItemKindConstant",      { fg = p.accent.orange })
          set(0, "CmpItemKindEnum",          { fg = p.accent.yellow })
          set(0, "CmpItemKindStruct",        { fg = p.accent.yellow })
          set(0, "CmpItemMenu",              { fg = p.text.comment })

          -- ── Indent Blankline ──
          set(0, "IblIndent",                { fg = p.base.border })
          set(0, "IblScope",                 { fg = p.accent.purple })

          -- ── nvim-tree / neo-tree ──
          set(0, "NeoTreeNormal",            { fg = p.text.fg, bg = p.base.bg_dim })
          set(0, "NeoTreeNormalNC",          { fg = p.text.fg, bg = p.base.bg_dim })
          set(0, "NeoTreeDirectoryName",     { fg = p.accent.blue })
          set(0, "NeoTreeDirectoryIcon",     { fg = p.accent.blue })
          set(0, "NeoTreeGitAdded",          { fg = p.git.add })
          set(0, "NeoTreeGitModified",       { fg = p.git.change })
          set(0, "NeoTreeGitDeleted",        { fg = p.git.delete })
          set(0, "NeoTreeIndentMarker",      { fg = p.base.border })
          set(0, "NeoTreeRootName",          { fg = p.accent.purple, bold = true })

          -- ── Lazy.nvim ──
          set(0, "LazyButton",               { fg = p.text.fg, bg = p.base.bg2 })
          set(0, "LazyButtonActive",          { fg = p.base.bg, bg = p.accent.purple, bold = true })
          set(0, "LazyH1",                   { fg = p.base.bg, bg = p.accent.purple, bold = true })
          set(0, "LazySpecial",              { fg = p.accent.cyan })

          -- ── Which-key ──
          set(0, "WhichKey",                 { fg = p.accent.purple })
          set(0, "WhichKeyGroup",            { fg = p.accent.blue })
          set(0, "WhichKeyDesc",             { fg = p.text.fg })
          set(0, "WhichKeySeparator",        { fg = p.text.comment })
          set(0, "WhichKeyValue",            { fg = p.text.comment })

          -- ── Notify ──
          set(0, "NotifyERRORBorder",        { fg = p.diagnostic.error })
          set(0, "NotifyWARNBorder",         { fg = p.diagnostic.warn })
          set(0, "NotifyINFOBorder",         { fg = p.diagnostic.info })
          set(0, "NotifyDEBUGBorder",        { fg = p.text.comment })
          set(0, "NotifyTRACEBorder",        { fg = p.accent.purple })
          set(0, "NotifyERRORIcon",          { fg = p.diagnostic.error })
          set(0, "NotifyWARNIcon",           { fg = p.diagnostic.warn })
          set(0, "NotifyINFOIcon",           { fg = p.diagnostic.info })
          set(0, "NotifyDEBUGIcon",          { fg = p.text.comment })
          set(0, "NotifyTRACEIcon",          { fg = p.accent.purple })
          set(0, "NotifyERRORTitle",         { fg = p.diagnostic.error })
          set(0, "NotifyWARNTitle",          { fg = p.diagnostic.warn })
          set(0, "NotifyINFOTitle",          { fg = p.diagnostic.info })
          set(0, "NotifyDEBUGTitle",         { fg = p.text.comment })
          set(0, "NotifyTRACETitle",         { fg = p.accent.purple })

          -- ── Mini plugins ──
          set(0, "MiniStatuslineFilename",   { fg = p.text.fg_dim, bg = p.base.bg1 })
          set(0, "MiniStatuslineDevinfo",    { fg = p.text.fg_dim, bg = p.base.bg2 })
          set(0, "MiniStatuslineModeNormal", { fg = p.base.bg, bg = p.accent.blue, bold = true })
          set(0, "MiniStatuslineModeInsert", { fg = p.base.bg, bg = p.accent.green, bold = true })
          set(0, "MiniStatuslineModeVisual", { fg = p.base.bg, bg = p.accent.purple, bold = true })
          set(0, "MiniStatuslineModeCommand",{ fg = p.base.bg, bg = p.accent.yellow, bold = true })
          set(0, "MiniStatuslineModeReplace",{ fg = p.base.bg, bg = p.accent.red, bold = true })
        end

        return M
    """)


def gen_nvim_init() -> str:
    """Generate lua/zenith/init.lua — main plugin entry."""
    return textwrap.dedent("""\
        -- Zenith colorscheme for Neovim
        local M = {}

        M.config = {
          style = "auto",          -- "dark", "light", or "auto" (follows vim.o.background)
          transparent = false,     -- transparent background
          dim_inactive = true,     -- dim non-active splits (depth-of-field effect)
        }

        function M.setup(opts)
          M.config = vim.tbl_deep_extend("force", M.config, opts or {})
        end

        function M.load()
          if vim.g.colors_name then
            vim.cmd("hi clear")
          end
          vim.o.termguicolors = true
          vim.g.colors_name = "zenith"

          local config = M.config
          local style = config.style
          if style == "auto" then
            style = vim.o.background
          else
            vim.o.background = style
          end

          local palette = require("zenith.palette")
          local p = palette[style] or palette.dark

          -- Apply highlight groups
          require("zenith.theme").setup(p, config)

          -- Apply terminal ANSI colors
          vim.g.terminal_color_0  = p.base.bg1
          vim.g.terminal_color_1  = p.accent.red
          vim.g.terminal_color_2  = p.accent.green
          vim.g.terminal_color_3  = p.accent.yellow
          vim.g.terminal_color_4  = p.accent.blue
          vim.g.terminal_color_5  = p.accent.purple
          vim.g.terminal_color_6  = p.accent.cyan
          vim.g.terminal_color_7  = p.text.fg
          vim.g.terminal_color_8  = p.text.comment
          vim.g.terminal_color_9  = p.accent.red
          vim.g.terminal_color_10 = p.accent.green
          vim.g.terminal_color_11 = p.accent.yellow
          vim.g.terminal_color_12 = p.accent.blue
          vim.g.terminal_color_13 = p.accent.purple
          vim.g.terminal_color_14 = p.accent.cyan
          vim.g.terminal_color_15 = p.text.fg
        end

        return M
    """)


def gen_nvim_colors() -> str:
    """Generate colors/zenith.lua — :colorscheme zenith entry point."""
    return textwrap.dedent("""\
        -- :colorscheme zenith
        require("zenith").load()
    """)


def gen_nvim_lualine(palette: dict) -> str:
    """Generate lua/lualine/themes/zenith.lua"""
    def mode_block(p: dict) -> str:
        return textwrap.dedent(f"""\
          local p = palette.{list(p.keys())[0] if isinstance(p, dict) else "dark"}
        """)

    # Generate for both modes
    return textwrap.dedent("""\
        -- Zenith lualine theme (generated)
        local palette = require("zenith.palette")

        local function get_theme()
          local style = vim.o.background or "dark"
          local p = palette[style] or palette.dark

          return {
            normal = {
              a = { fg = p.base.bg, bg = p.accent.blue, gui = "bold" },
              b = { fg = p.text.fg_dim, bg = p.base.bg2 },
              c = { fg = p.text.comment, bg = "NONE" },
            },
            insert = {
              a = { fg = p.base.bg, bg = p.accent.green, gui = "bold" },
              b = { fg = p.text.fg_dim, bg = p.base.bg2 },
            },
            visual = {
              a = { fg = p.base.bg, bg = p.accent.purple, gui = "bold" },
              b = { fg = p.text.fg_dim, bg = p.base.bg2 },
            },
            replace = {
              a = { fg = p.base.bg, bg = p.accent.red, gui = "bold" },
              b = { fg = p.text.fg_dim, bg = p.base.bg2 },
            },
            command = {
              a = { fg = p.base.bg, bg = p.accent.yellow, gui = "bold" },
              b = { fg = p.text.fg_dim, bg = p.base.bg2 },
            },
            inactive = {
              a = { fg = p.text.comment, bg = p.base.bg1 },
              b = { fg = p.text.comment, bg = p.base.bg1 },
              c = { fg = p.text.comment, bg = "NONE" },
            },
          }
        end

        return get_theme()
    """)


# ─── Install / Switch scripts ─────────────────────────────────────


def gen_opencode(palette: dict, mode: str) -> str:
    """Generate an opencode TUI theme (JSON) for the given mode.

    Follows https://opencode.ai/theme.json schema. Emits one file per mode so
    theme-tape can point tui.json at zenith-dark or zenith-light deterministically.
    """
    p = palette[mode]
    b = p["base"]
    t = p["text"]
    a = p["accent"]
    d = p["diagnostic"]
    g = p["git"]

    theme = {
        "primary": a["purple"],
        "secondary": a["blue"],
        "accent": a["cyan"],
        "error": d["error"],
        "warning": d["warn"],
        "success": d["hint"],
        "info": d["info"],

        "text": t["fg"],
        "textMuted": t["fg_dim"],

        "background": b["bg"],
        "backgroundPanel": b["bg1"],
        "backgroundElement": b["bg2"],

        "border": b["border"],
        "borderActive": a["purple"],
        "borderSubtle": t["comment"],

        "diffAdded": g["add"],
        "diffRemoved": g["delete"],
        "diffContext": t["fg_dim"],
        "diffHunkHeader": a["cyan"],
        "diffHighlightAdded": g["add"],
        "diffHighlightRemoved": g["delete"],
        "diffAddedBg": b["bg1"],
        "diffRemovedBg": b["bg1"],
        "diffContextBg": b["bg"],
        "diffLineNumber": t["comment"],
        "diffAddedLineNumberBg": b["bg1"],
        "diffRemovedLineNumberBg": b["bg1"],

        "markdownText": t["fg"],
        "markdownHeading": a["purple"],
        "markdownLink": a["cyan"],
        "markdownLinkText": a["blue"],
        "markdownCode": a["orange"],
        "markdownBlockQuote": t["fg_dim"],
        "markdownEmph": a["yellow"],
        "markdownStrong": a["orange"],
        "markdownHorizontalRule": t["comment"],
        "markdownListItem": a["cyan"],
        "markdownListEnumeration": a["cyan"],
        "markdownImage": a["pink"],
        "markdownImageText": t["fg"],
        "markdownCodeBlock": a["green"],

        "syntaxComment": t["comment"],
        "syntaxKeyword": a["purple"],
        "syntaxFunction": a["blue"],
        "syntaxVariable": t["fg"],
        "syntaxString": a["green"],
        "syntaxNumber": a["orange"],
        "syntaxType": a["yellow"],
        "syntaxOperator": a["pink"],
        "syntaxPunctuation": t["fg_dim"],
    }

    doc = {
        "$schema": "https://opencode.ai/theme.json",
        "theme": theme,
    }

    return json.dumps(doc, indent=2) + "\n"


# ─── Install / Switch scripts ─────────────────────────────────────


def gen_install_sh() -> str:
    return textwrap.dedent("""\
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
          echo '    if-shell "grep -q dark ~/.tmux/theme_state" \\\\'
          echo '      "source-file ~/.tmux/themes/zenith-dark.conf" \\\\'
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
    """)


def gen_switch_sh() -> str:
    return textwrap.dedent("""\
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
          nvim --server "$sock" --remote-send "<Cmd>lua require(\\"zenith\\").setup({ style = \\"$MODE\\" }) | set background=$MODE | colorscheme zenith<CR>" 2>/dev/null || true
        done
        echo "  ✓ Neovim → background=$MODE"

        echo "Done! Now in $MODE mode."
    """)


# ─── Main ─────────────────────────────────────────────────────────


def main():
    palette = load_palette()

    # Ghostty
    write(DIST / "ghostty" / "zenith-dark", gen_ghostty(palette, "dark"))
    write(DIST / "ghostty" / "zenith-light", gen_ghostty(palette, "light"))
    write(DIST / "ghostty" / "config-snippet", gen_ghostty_snippet(palette))

    # Tmux
    write(DIST / "tmux" / "zenith-dark.conf", gen_tmux(palette, "dark"))
    write(DIST / "tmux" / "zenith-light.conf", gen_tmux(palette, "light"))
    write(DIST / "tmux" / "truecolor.conf", gen_tmux_truecolor())

    # Yazi
    write(DIST / "yazi" / "flavors" / "zenith-dark.yazi" / "flavor.toml", gen_yazi(palette, "dark"))
    write(DIST / "yazi" / "flavors" / "zenith-light.yazi" / "flavor.toml", gen_yazi(palette, "light"))
    write(DIST / "yazi" / "theme.toml", gen_yazi_theme_pointer())

    # Opencode
    write(DIST / "opencode" / "zenith-dark.json", gen_opencode(palette, "dark"))
    write(DIST / "opencode" / "zenith-light.json", gen_opencode(palette, "light"))

    # Neovim plugin
    nvim = DIST / "nvim" / "zenith.nvim"
    write(nvim / "colors" / "zenith.lua", gen_nvim_colors())
    write(nvim / "lua" / "zenith" / "init.lua", gen_nvim_init())
    write(nvim / "lua" / "zenith" / "palette.lua", gen_nvim_palette(palette))
    write(nvim / "lua" / "zenith" / "theme.lua", gen_nvim_theme())
    write(nvim / "lua" / "lualine" / "themes" / "zenith.lua", gen_nvim_lualine(palette))

    # Scripts
    write(ROOT / "install.sh", gen_install_sh())
    write(ROOT / "switch.sh", gen_switch_sh())
    os.chmod(ROOT / "install.sh", 0o755)
    os.chmod(ROOT / "switch.sh", 0o755)

    print("Generated all theme files!")
    print(f"  dist/ghostty/  — 2 theme files + config snippet")
    print(f"  dist/tmux/     — 2 theme configs (dark + light)")
    print(f"  dist/yazi/     — 2 theme configs (dark + light)")
    print(f"  dist/nvim/     — zenith.nvim plugin")
    print(f"  install.sh     — install/symlink script")
    print(f"  switch.sh      — dark/light mode switcher")


def write(path: Path, content: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)
    print(f"  → {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
