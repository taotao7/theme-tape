#!/usr/bin/env python3
"""Cassette Futurism Theme Generator

Reads palette.toml and generates unified configs for:
  - Ghostty terminal (theme files)
  - Tmux (status bar + colors)
  - Neovim (Lua colorscheme plugin)
  - Yazi (file manager flavor)
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
    obj = palette
    for key in path.split("."):
        obj = obj[key]
    return obj


def resolve_ansi(palette: dict, ansi_map: dict, mode: str) -> dict[int, str]:
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
        f"# Cassette Futurism {mode.title()} — Ghostty Theme",
        f"# Generated from palette.toml",
        "",
        f"background = {p['base']['bg']}",
        f"foreground = {p['text']['fg']}",
        f"cursor-color = {p['accent']['orange']}",
        f"cursor-text = {p['base']['bg']}",
        f"selection-background = {p['base']['bg3']}",
        f"selection-foreground = {p['text']['fg']}",
        "",
    ]
    for i in range(16):
        lines.append(f"palette = {i}={ansi[i]}")
    return "\n".join(lines) + "\n"


def gen_ghostty_snippet(palette: dict) -> str:
    return textwrap.dedent("""\
        # Cassette Futurism — Ghostty config snippet
        # Append to ~/.config/ghostty/config

        # Theme (switch between dark/light)
        theme = cassette-futurism-dark
        # theme = cassette-futurism-light

        # Font
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


def gen_tmux(palette: dict, mode: str) -> str:
    p = palette[mode]

    if mode == "dark":
        tmux = {
            "bg": "default",
            "fg": "#d7d0c2",
            "red": "#d97a66",
            "orange": "#d6a168",
            "yellow": "#c4b16f",
            "green": "#7fb081",
            "cyan": "#78a8a4",
            "blue": "#6f94a6",
            "purple": "#b08968",
            "pink": "#c37a63",
            "gray": "#7b847d",
            "dark": p["base"]["bg1"],
            "void": p["base"]["bg"],
            "active_bg": "#{@tape_orange}",
            "active_fg": "#{@tape_dark}",
            "mode_bg": "#{@tape_dark}",
            "mode_fg": "#{@tape_orange}",
            "message_bg": "#{@tape_dark}",
            "message_fg": "#{@tape_green}",
            "message_command_bg": "#{@tape_dark}",
            "message_command_fg": "#{@tape_cyan}",
            "pane_active_fg": "#{@tape_green}",
        }
    else:
        tmux = {
            "bg": p["base"]["bg"],
            "fg": p["text"]["fg"],
            "red": p["accent"]["red"],
            "orange": p["accent"]["orange"],
            "yellow": p["accent"]["yellow"],
            "green": p["accent"]["green"],
            "cyan": p["accent"]["cyan"],
            "blue": p["accent"]["blue"],
            "purple": p["accent"]["purple"],
            "pink": p["accent"]["pink"],
            "gray": p["text"]["comment"],
            "dark": p["base"]["bg1"],
            "void": p["base"]["bg"],
            "active_bg": "#{@tape_orange}",
            "active_fg": "#{@tape_bg}",
            "mode_bg": "#{@tape_orange}",
            "mode_fg": "#{@tape_dark}",
            "message_bg": "#{@tape_dark}",
            "message_fg": "#{@tape_orange}",
            "message_command_bg": "#{@tape_dark}",
            "message_command_fg": "#{@tape_orange}",
            "pane_active_fg": "#{@tape_orange}",
        }

    return textwrap.dedent(f"""\
        # --- Cassette Futurism: {mode.title()} Mode ---
        # Generated from palette.toml
        # Compatible with @tape_* variable convention

        # ── Palette Variables ──
        set -g @tape_bg "{tmux['bg']}"
        set -g @tape_fg "{tmux['fg']}"
        set -g @tape_red "{tmux['red']}"
        set -g @tape_orange "{tmux['orange']}"
        set -g @tape_yellow "{tmux['yellow']}"
        set -g @tape_green "{tmux['green']}"
        set -g @tape_cyan "{tmux['cyan']}"
        set -g @tape_blue "{tmux['blue']}"
        set -g @tape_purple "{tmux['purple']}"
        set -g @tape_pink "{tmux['pink']}"
        set -g @tape_gray "{tmux['gray']}"
        set -g @tape_dark "{tmux['dark']}"
        set -g @tape_void "{tmux['void']}"
        set -g @tape_active_bg "{tmux['active_bg']}"
        set -g @tape_active_fg "{tmux['active_fg']}"

        # ── Force Refresh Styles ──
        set -g status-style "bg={tmux['bg']},fg=#{{@tape_fg}}"
        set -g window-status-activity-style "fg=#{{@tape_orange}},bold"
        set -g window-status-bell-style "fg=#{{@tape_red}},bold,blink"
        set -g mode-style "bg={tmux['mode_bg']},fg={tmux['mode_fg']},bold"
        set -g message-style "bg={tmux['message_bg']},fg={tmux['message_fg']},border-style=double"
        set -g message-command-style "bg={tmux['message_command_bg']},fg={tmux['message_command_fg']}"
        setw -g pane-active-border-style "fg={tmux['pane_active_fg']},bg=default"
        setw -g pane-border-style "fg=#{{@tape_gray}},bg=default"

        # Copy mode styling
        setw -g mode-style "bg={tmux['mode_bg']},fg={tmux['mode_fg']},bold"
    """)


def gen_tmux_truecolor() -> str:
    return textwrap.dedent("""\
        # Cassette Futurism — Truecolor & Undercurl Passthrough
        # Source this in tmux.conf for proper color rendering
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
    p = palette[mode]
    b = p["base"]
    t = p["text"]
    a = p["accent"]
    d = p["diagnostic"]

    return textwrap.dedent(f"""\
        # Cassette Futurism {mode.title()} — Yazi Flavor
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
    return textwrap.dedent("""\
        # Cassette Futurism — Yazi Theme
        # Auto-switches between dark/light based on system appearance.

        [flavor]
        dark  = "cassette-futurism-dark"
        light = "cassette-futurism-light"
    """)


# ─── Neovim ───────────────────────────────────────────────────────


def gen_nvim_palette(palette: dict) -> str:
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
        -- Cassette Futurism palette (generated from palette.toml)
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
    return textwrap.dedent("""\
        -- Cassette Futurism highlight groups (generated)
        local M = {}

        function M.setup(p, config)
          local set = vim.api.nvim_set_hl

          -- ── Editor UI ──
          set(0, "Normal",           { fg = p.text.fg, bg = config.transparent and "NONE" or p.base.bg })
          set(0, "NormalNC",         { fg = config.dim_inactive and p.text.comment or p.text.fg, bg = config.transparent and "NONE" or (config.dim_inactive and p.base.bg_dim or p.base.bg) })
          set(0, "NormalFloat",      { fg = p.text.fg, bg = p.base.bg2 })
          set(0, "FloatBorder",      { fg = p.base.border, bg = p.base.bg2 })
          set(0, "FloatTitle",       { fg = p.accent.orange, bg = p.base.bg2, bold = true })
          set(0, "Cursor",           { fg = p.base.bg, bg = p.accent.orange })
          set(0, "CursorLine",       { bg = p.base.bg4 })
          set(0, "CursorLineNr",     { fg = p.accent.orange, bold = true })
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
          set(0, "TabLineSel",       { fg = p.accent.orange, bg = p.base.bg, bold = true })
          set(0, "Pmenu",            { fg = p.text.fg, bg = p.base.bg2 })
          set(0, "PmenuSel",         { fg = p.base.bg, bg = p.accent.orange })
          set(0, "PmenuSbar",        { bg = p.base.bg3 })
          set(0, "PmenuThumb",       { bg = p.accent.orange })
          set(0, "Visual",           { bg = p.base.bg3 })
          set(0, "VisualNOS",        { bg = p.base.bg3 })
          set(0, "Search",           { fg = p.base.bg, bg = p.accent.yellow })
          set(0, "IncSearch",        { fg = p.base.bg, bg = p.accent.orange })
          set(0, "CurSearch",        { fg = p.base.bg, bg = p.accent.cyan })
          set(0, "Substitute",       { fg = p.base.bg, bg = p.accent.red })
          set(0, "MatchParen",       { fg = p.accent.orange, bold = true, underline = true })
          set(0, "NonText",          { fg = p.base.border })
          set(0, "Whitespace",       { fg = p.base.border })
          set(0, "SpecialKey",       { fg = p.base.border })
          set(0, "Directory",        { fg = p.accent.blue })
          set(0, "Title",            { fg = p.accent.orange, bold = true })
          set(0, "ErrorMsg",         { fg = p.diagnostic.error })
          set(0, "WarningMsg",       { fg = p.diagnostic.warn })
          set(0, "MoreMsg",          { fg = p.accent.cyan })
          set(0, "Question",         { fg = p.accent.cyan })
          set(0, "WildMenu",         { fg = p.base.bg, bg = p.accent.orange })
          set(0, "Conceal",          { fg = p.text.comment })
          set(0, "SpellBad",         { sp = p.diagnostic.error, undercurl = true })
          set(0, "SpellCap",         { sp = p.diagnostic.warn, undercurl = true })
          set(0, "SpellLocal",       { sp = p.diagnostic.info, undercurl = true })
          set(0, "SpellRare",        { sp = p.diagnostic.hint, undercurl = true })

          -- ── Syntax (legacy vim groups) ──
          set(0, "Comment",          { fg = p.text.comment, italic = true })
          set(0, "Constant",         { fg = p.accent.cyan })
          set(0, "String",           { fg = p.accent.green })
          set(0, "Character",        { fg = p.accent.green })
          set(0, "Number",           { fg = p.accent.cyan })
          set(0, "Boolean",          { fg = p.accent.cyan })
          set(0, "Float",            { fg = p.accent.cyan })
          set(0, "Identifier",       { fg = p.text.fg })
          set(0, "Function",         { fg = p.accent.orange })
          set(0, "Statement",        { fg = p.accent.orange })
          set(0, "Conditional",      { fg = p.accent.orange })
          set(0, "Repeat",           { fg = p.accent.orange })
          set(0, "Label",            { fg = p.accent.cyan })
          set(0, "Operator",         { fg = p.accent.pink })
          set(0, "Keyword",          { fg = p.accent.orange })
          set(0, "Exception",        { fg = p.accent.orange })
          set(0, "PreProc",          { fg = p.accent.pink })
          set(0, "Include",          { fg = p.accent.pink })
          set(0, "Define",           { fg = p.accent.pink })
          set(0, "Macro",            { fg = p.accent.pink })
          set(0, "PreCondit",        { fg = p.accent.pink })
          set(0, "Type",             { fg = p.accent.purple })
          set(0, "StorageClass",     { fg = p.accent.purple })
          set(0, "Structure",        { fg = p.accent.purple })
          set(0, "Typedef",          { fg = p.accent.purple })
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
          set(0, "@keyword",                { fg = p.accent.orange })
          set(0, "@keyword.conditional",    { fg = p.accent.orange })
          set(0, "@keyword.repeat",         { fg = p.accent.orange })
          set(0, "@keyword.return",         { fg = p.accent.orange })
          set(0, "@keyword.function",       { fg = p.accent.orange })
          set(0, "@keyword.operator",       { fg = p.accent.pink })
          set(0, "@keyword.import",         { fg = p.accent.pink })
          set(0, "@keyword.exception",      { fg = p.accent.orange })

          set(0, "@function",               { fg = p.accent.orange })
          set(0, "@function.call",          { fg = p.accent.orange })
          set(0, "@function.builtin",       { fg = p.accent.cyan })
          set(0, "@function.method",        { fg = p.accent.orange })
          set(0, "@function.method.call",   { fg = p.accent.orange })
          set(0, "@constructor",            { fg = p.accent.purple })
          set(0, "@type",                   { fg = p.accent.purple })
          set(0, "@type.builtin",           { fg = p.accent.purple, italic = true })
          set(0, "@type.definition",        { fg = p.accent.purple })

          set(0, "@variable",               { fg = p.text.fg })
          set(0, "@variable.builtin",       { fg = p.accent.cyan, italic = true })
          set(0, "@variable.parameter",     { fg = p.accent.cyan })
          set(0, "@variable.member",        { fg = p.text.fg })
          set(0, "@property",               { fg = p.text.fg })
          set(0, "@constant",               { fg = p.accent.cyan })
          set(0, "@constant.builtin",       { fg = p.accent.cyan, italic = true })

          set(0, "@string",                 { fg = p.accent.green })
          set(0, "@string.escape",          { fg = p.accent.pink })
          set(0, "@string.regex",           { fg = p.accent.pink })
          set(0, "@string.special",         { fg = p.accent.pink })
          set(0, "@character",              { fg = p.accent.green })
          set(0, "@number",                 { fg = p.accent.cyan })
          set(0, "@boolean",                { fg = p.accent.cyan })

          set(0, "@comment",                { fg = p.text.comment, italic = true })
          set(0, "@comment.documentation",  { fg = p.text.comment, italic = true })
          set(0, "@comment.todo",           { fg = p.accent.yellow, bold = true })
          set(0, "@comment.note",           { fg = p.accent.cyan, bold = true })
          set(0, "@comment.warning",        { fg = p.diagnostic.warn, bold = true })
          set(0, "@comment.error",          { fg = p.diagnostic.error, bold = true })
          set(0, "@punctuation.bracket",    { fg = p.text.fg_dim })
          set(0, "@punctuation.delimiter",  { fg = p.text.fg_dim })
          set(0, "@punctuation.special",    { fg = p.accent.pink })

          set(0, "@tag",                    { fg = p.accent.pink })
          set(0, "@tag.attribute",          { fg = p.accent.orange, italic = true })
          set(0, "@tag.delimiter",          { fg = p.text.fg_dim })
          set(0, "@attribute",              { fg = p.accent.orange })
          set(0, "@module",                 { fg = p.accent.purple })
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
          set(0, "TelescopePromptTitle",     { fg = p.base.bg, bg = p.accent.orange, bold = true })
          set(0, "TelescopePreviewTitle",    { fg = p.base.bg, bg = p.accent.blue, bold = true })
          set(0, "TelescopeResultsTitle",    { fg = p.base.bg, bg = p.accent.cyan, bold = true })
          set(0, "TelescopeSelection",       { bg = p.base.bg3 })
          set(0, "TelescopeMatching",        { fg = p.accent.orange, bold = true })

          -- ── nvim-cmp ──
          set(0, "CmpItemAbbr",              { fg = p.text.fg })
          set(0, "CmpItemAbbrMatch",         { fg = p.accent.orange, bold = true })
          set(0, "CmpItemAbbrMatchFuzzy",    { fg = p.accent.orange, bold = true })
          set(0, "CmpItemAbbrDeprecated",    { fg = p.text.comment, strikethrough = true })
          set(0, "CmpItemKindFunction",      { fg = p.accent.orange })
          set(0, "CmpItemKindMethod",        { fg = p.accent.orange })
          set(0, "CmpItemKindVariable",      { fg = p.accent.cyan })
          set(0, "CmpItemKindKeyword",       { fg = p.accent.orange })
          set(0, "CmpItemKindText",          { fg = p.text.fg_dim })
          set(0, "CmpItemKindSnippet",       { fg = p.accent.yellow })
          set(0, "CmpItemKindClass",         { fg = p.accent.purple })
          set(0, "CmpItemKindInterface",     { fg = p.accent.purple })
          set(0, "CmpItemKindModule",        { fg = p.accent.purple })
          set(0, "CmpItemKindProperty",      { fg = p.text.fg })
          set(0, "CmpItemKindField",         { fg = p.text.fg })
          set(0, "CmpItemKindConstant",      { fg = p.accent.cyan })
          set(0, "CmpItemKindEnum",          { fg = p.accent.purple })
          set(0, "CmpItemKindStruct",        { fg = p.accent.purple })
          set(0, "CmpItemMenu",              { fg = p.text.comment })

          -- ── Indent Blankline ──
          set(0, "IblIndent",                { fg = p.base.border })
          set(0, "IblScope",                 { fg = p.accent.orange })

          -- ── nvim-tree / neo-tree ──
          set(0, "NeoTreeNormal",            { fg = p.text.fg, bg = p.base.bg_dim })
          set(0, "NeoTreeNormalNC",          { fg = p.text.fg, bg = p.base.bg_dim })
          set(0, "NeoTreeDirectoryName",     { fg = p.accent.blue })
          set(0, "NeoTreeDirectoryIcon",     { fg = p.accent.blue })
          set(0, "NeoTreeGitAdded",          { fg = p.git.add })
          set(0, "NeoTreeGitModified",       { fg = p.git.change })
          set(0, "NeoTreeGitDeleted",        { fg = p.git.delete })
          set(0, "NeoTreeIndentMarker",      { fg = p.base.border })
          set(0, "NeoTreeRootName",          { fg = p.accent.orange, bold = true })

          -- ── Lazy.nvim ──
          set(0, "LazyButton",               { fg = p.text.fg, bg = p.base.bg2 })
          set(0, "LazyButtonActive",          { fg = p.base.bg, bg = p.accent.orange, bold = true })
          set(0, "LazyH1",                   { fg = p.base.bg, bg = p.accent.orange, bold = true })
          set(0, "LazySpecial",              { fg = p.accent.cyan })

          -- ── Which-key ──
          set(0, "WhichKey",                 { fg = p.accent.orange })
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
    return textwrap.dedent("""\
        -- Cassette Futurism colorscheme for Neovim
        local M = {}

        M.config = {
          style = "auto",          -- "dark", "light", or "auto" (follows vim.o.background)
          transparent = false,
          dim_inactive = true,
        }

        function M.setup(opts)
          M.config = vim.tbl_deep_extend("force", M.config, opts or {})
        end

        function M.load()
          if vim.g.colors_name then
            vim.cmd("hi clear")
          end
          vim.o.termguicolors = true
          vim.g.colors_name = "cassette-futurism"

          local config = M.config
          local style = config.style
          if style == "auto" then
            style = vim.o.background
          else
            vim.o.background = style
          end

          local palette = require("cassette-futurism.palette")
          local p = palette[style] or palette.dark

          require("cassette-futurism.theme").setup(p, config)

          -- Terminal ANSI colors
          vim.g.terminal_color_0  = p.base.bg1
          vim.g.terminal_color_1  = p.accent.red
          vim.g.terminal_color_2  = p.accent.green
          vim.g.terminal_color_3  = p.accent.orange
          vim.g.terminal_color_4  = p.accent.blue
          vim.g.terminal_color_5  = p.accent.purple
          vim.g.terminal_color_6  = p.accent.cyan
          vim.g.terminal_color_7  = p.text.fg
          vim.g.terminal_color_8  = p.text.comment
          vim.g.terminal_color_9  = p.accent.red
          vim.g.terminal_color_10 = p.accent.green
          vim.g.terminal_color_11 = p.accent.orange
          vim.g.terminal_color_12 = p.accent.blue
          vim.g.terminal_color_13 = p.accent.purple
          vim.g.terminal_color_14 = p.accent.cyan
          vim.g.terminal_color_15 = p.text.fg
        end

        return M
    """)


def gen_nvim_colors() -> str:
    return textwrap.dedent("""\
        -- :colorscheme cassette-futurism
        require("cassette-futurism").load()
    """)


def gen_nvim_lualine(palette: dict) -> str:
    return textwrap.dedent("""\
        -- Cassette Futurism lualine theme (generated)
        local palette = require("cassette-futurism.palette")

        local function get_theme()
          local style = vim.o.background or "dark"
          local p = palette[style] or palette.dark

          return {
            normal = {
              a = { fg = p.base.bg, bg = p.accent.orange, gui = "bold" },
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
              a = { fg = p.base.bg, bg = p.accent.cyan, gui = "bold" },
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
    """Generate an opencode TUI theme (JSON) for the given mode."""
    p = palette[mode]
    b = p["base"]
    t = p["text"]
    a = p["accent"]
    d = p["diagnostic"]
    g = p["git"]

    theme = {
        "primary": a["orange"],
        "secondary": a["green"],
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
        "borderActive": a["orange"],
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
        "markdownHeading": a["orange"],
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
        "syntaxKeyword": a["orange"],
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
          echo '    if-shell "grep -q dark ~/.tmux/theme_state" \\\\'
          echo '      "source-file ~/.tmux/themes/cassette-futurism-dark.conf" \\\\'
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
    """)


def gen_switch_sh() -> str:
    return textwrap.dedent("""\
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
          nvim --server "$sock" --remote-send "<Cmd>lua require(\\"cassette-futurism\\").setup({ style = \\"$MODE\\" }) | set background=$MODE | colorscheme cassette-futurism<CR>" 2>/dev/null || true
        done
        echo "  ✓ Neovim → background=$MODE"

        echo "Done! Now in $MODE mode."
    """)


# ─── Main ─────────────────────────────────────────────────────────


def main():
    palette = load_palette()

    # Ghostty
    write(DIST / "ghostty" / "cassette-futurism-dark", gen_ghostty(palette, "dark"))
    write(DIST / "ghostty" / "cassette-futurism-light", gen_ghostty(palette, "light"))
    write(DIST / "ghostty" / "config-snippet", gen_ghostty_snippet(palette))

    # Tmux
    write(DIST / "tmux" / "cassette-futurism-dark.conf", gen_tmux(palette, "dark"))
    write(DIST / "tmux" / "cassette-futurism-light.conf", gen_tmux(palette, "light"))
    write(DIST / "tmux" / "truecolor.conf", gen_tmux_truecolor())

    # Yazi
    write(DIST / "yazi" / "flavors" / "cassette-futurism-dark.yazi" / "flavor.toml", gen_yazi(palette, "dark"))
    write(DIST / "yazi" / "flavors" / "cassette-futurism-light.yazi" / "flavor.toml", gen_yazi(palette, "light"))
    write(DIST / "yazi" / "theme.toml", gen_yazi_theme_pointer())

    # Opencode
    write(DIST / "opencode" / "cassette-futurism-dark.json", gen_opencode(palette, "dark"))
    write(DIST / "opencode" / "cassette-futurism-light.json", gen_opencode(palette, "light"))

    # Neovim plugin
    nvim = DIST / "nvim" / "cassette-futurism.nvim"
    write(nvim / "colors" / "cassette-futurism.lua", gen_nvim_colors())
    write(nvim / "lua" / "cassette-futurism" / "init.lua", gen_nvim_init())
    write(nvim / "lua" / "cassette-futurism" / "palette.lua", gen_nvim_palette(palette))
    write(nvim / "lua" / "cassette-futurism" / "theme.lua", gen_nvim_theme())
    write(nvim / "lua" / "lualine" / "themes" / "cassette-futurism.lua", gen_nvim_lualine(palette))

    # Scripts
    write(ROOT / "install.sh", gen_install_sh())
    write(ROOT / "switch.sh", gen_switch_sh())
    os.chmod(ROOT / "install.sh", 0o755)
    os.chmod(ROOT / "switch.sh", 0o755)

    print("Generated all theme files!")
    print(f"  dist/ghostty/  — 2 theme files + config snippet")
    print(f"  dist/tmux/     — 2 theme configs (dark + light)")
    print(f"  dist/yazi/     — 2 theme configs (dark + light)")
    print(f"  dist/nvim/     — cassette-futurism.nvim plugin")
    print(f"  install.sh     — install/symlink script")
    print(f"  switch.sh      — dark/light mode switcher")


def write(path: Path, content: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)
    print(f"  → {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
