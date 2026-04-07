import {afterEach, describe, expect, test} from "bun:test";
import {mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {applyTheme, configureNvim, configureTargets, installThemeAssets, readThemeTapeConfig, renderDoctorReport, renderYaziThemeToml, setTransparencyMode} from "../manager";
import {REPO_ROOT, resolveThemeId, THEMES, THEME_ORDER} from "../theme-registry";

const created: string[] = [];

afterEach(() => {
  while (created.length > 0) {
    const path = created.pop();
    if (path) {
      rmSync(path, {recursive: true, force: true});
    }
  }
});

describe("theme-tape manager", () => {
  test("loads themes from theme manifests", () => {
    expect(THEME_ORDER).toEqual(["zenith", "cassette-futurism"]);
    expect(THEMES["cassette-futurism"]?.label).toBe("Cassette Futurism");
    expect(resolveThemeId("cassette")).toBe("cassette-futurism");
  });

  test("installs both theme asset sets", () => {
    const root = mkdtempSync(join(tmpdir(), "theme-tape-install-"));
    created.push(root);

    installThemeAssets("all", undefined, {
      repoRoot: REPO_ROOT,
      homeDir: root,
      configHome: join(root, ".config"),
      dataHome: join(root, ".local", "share"),
      reloadTmux: false,
      refreshNeovim: false,
    });

    expect(realpathSync(join(root, ".config/ghostty/themes/zenith-dark"))).toBe(join(REPO_ROOT, "themes/zenith/dist/ghostty/zenith-dark"));
    expect(realpathSync(join(root, ".config/ghostty/themes/cassette-futurism-dark"))).toBe(join(REPO_ROOT, "themes/cassette-futurism/dist/ghostty/cassette-futurism-dark"));
    expect(realpathSync(join(root, ".local/share/nvim/site/pack/theme-tape/start/zenith.nvim"))).toBe(join(REPO_ROOT, "themes/zenith/dist/nvim/zenith.nvim"));
  });

  test("applies theme state and rewrites yazi pointer", () => {
    const root = mkdtempSync(join(tmpdir(), "theme-tape-apply-"));
    created.push(root);

    applyTheme("zenith", "light", undefined, {
      repoRoot: REPO_ROOT,
      homeDir: root,
      configHome: join(root, ".config"),
      dataHome: join(root, ".local", "share"),
      reloadTmux: false,
      refreshNeovim: false,
    });

    expect(readFileSync(join(root, ".tmux/theme_state"), "utf8").trim()).toBe("light");
    expect(readFileSync(join(root, ".tmux/theme_name"), "utf8").trim()).toBe("zenith");
    expect(readFileSync(join(root, ".config/ghostty/config"), "utf8")).toContain("theme = dark:zenith-dark,light:zenith-light");
    expect(readFileSync(join(root, ".config/yazi/theme.toml"), "utf8")).toBe(renderYaziThemeToml("zenith"));
  });

  test("toggle mode flips the saved mode", () => {
    const root = mkdtempSync(join(tmpdir(), "theme-tape-toggle-"));
    created.push(root);

    applyTheme("cassette-futurism", "dark", undefined, {
      repoRoot: REPO_ROOT,
      homeDir: root,
      configHome: join(root, ".config"),
      dataHome: join(root, ".local", "share"),
      reloadTmux: false,
      refreshNeovim: false,
    });

    const result = applyTheme("cassette-futurism", "toggle", undefined, {
      repoRoot: REPO_ROOT,
      homeDir: root,
      configHome: join(root, ".config"),
      dataHome: join(root, ".local", "share"),
      reloadTmux: false,
      refreshNeovim: false,
    });

    expect(result.state?.mode).toBe("light");
    expect(readFileSync(join(root, ".tmux/theme_state"), "utf8").trim()).toBe("light");
  });

  test("doctor reports real nvim paths", () => {
    const root = mkdtempSync(join(tmpdir(), "theme-tape-doctor-"));
    created.push(root);

    const report = renderDoctorReport({
      repoRoot: REPO_ROOT,
      homeDir: root,
      configHome: join(root, ".config"),
      dataHome: join(root, ".local", "share"),
      runtimeDir: join(root, ".runtime"),
      reloadTmux: false,
      refreshNeovim: false,
    });

    expect(report).toContain("theme-tape doctor");
    expect(report).toContain(join(REPO_ROOT, "themes", "zenith", "dist", "nvim", "zenith.nvim"));
    expect(report).toContain(join(root, ".local", "share", "nvim", "site", "pack", "theme-tape", "start", "zenith.nvim"));
  });

  test("configures astronvim via plugin spec path", () => {
    const root = mkdtempSync(join(tmpdir(), "theme-tape-astro-"));
    created.push(root);

    mkdirSync(join(root, ".config/nvim/lua"), {recursive: true});
    writeFileSync(join(root, ".config/nvim/lua/lazy_setup.lua"), "", "utf8");

    const result = configureNvim({
      repoRoot: REPO_ROOT,
      homeDir: root,
      configHome: join(root, ".config"),
      dataHome: join(root, ".local", "share"),
      reloadTmux: false,
      refreshNeovim: false,
    });

    expect(result.flavor).toBe("astronvim");
    expect(readFileSync(join(root, ".config/nvim/lua/plugins/theme-tape.lua"), "utf8")).toContain('colorscheme = read_state("theme_name", theme)');
    expect(readFileSync(join(root, ".config/nvim/lua/plugins/theme-tape.lua"), "utf8")).toContain('set_dark_mode = function()');
    expect(readFileSync(join(root, ".config/nvim/lua/plugins/theme-tape.lua"), "utf8")).toContain('write_state("theme_state", mode)');
    expect(readFileSync(join(root, ".config/nvim/lua/plugins/theme-tape.lua"), "utf8")).toContain('theme = read_state("theme_name", theme)');
    expect(readFileSync(join(root, ".config/nvim/lua/plugins/theme-tape.lua"), "utf8")).toContain('vim.fn.system({ "tmux", "source-file", tmux_config })');
  });

  test("configures standard neovim via plugin path", () => {
    const root = mkdtempSync(join(tmpdir(), "theme-tape-nvim-"));
    created.push(root);

    const result = configureNvim({
      repoRoot: REPO_ROOT,
      homeDir: root,
      configHome: join(root, ".config"),
      dataHome: join(root, ".local", "share"),
      reloadTmux: false,
      refreshNeovim: false,
    });

    expect(result.flavor).toBe("neovim");
    expect(readFileSync(join(root, ".config/nvim/plugin/theme-tape.lua"), "utf8")).toContain('vim.opt.runtimepath:append(theme_root .. "/zenith.nvim")');
  });

  test("configures ghostty tmux and yazi paths dynamically", () => {
    const root = mkdtempSync(join(tmpdir(), "theme-tape-configure-"));
    created.push(root);
    mkdirSync(join(root, ".config", "tmux"), {recursive: true});
    writeFileSync(
      join(root, ".config/tmux/tmux.conf"),
      [
        '# --- Theme Management ---',
        'if-shell "test ! -f ~/.tmux/theme_state" "run-shell \'echo dark > ~/.tmux/theme_state\'"',
        'if-shell "grep -q dark ~/.tmux/theme_state" "source-file ~/.tmux/themes/zenith-dark.conf" "source-file ~/.tmux/themes/zenith-light.conf"',
        "",
      ].join("\n"),
      "utf8",
    );

    applyTheme("cassette-futurism", "light", undefined, {
      repoRoot: REPO_ROOT,
      homeDir: root,
      configHome: join(root, ".config"),
      dataHome: join(root, ".local", "share"),
      reloadTmux: false,
      refreshNeovim: false,
    });

    const messages = configureTargets("all", {
      repoRoot: REPO_ROOT,
      homeDir: root,
      configHome: join(root, ".config"),
      dataHome: join(root, ".local", "share"),
      reloadTmux: false,
      refreshNeovim: false,
    });

    expect(messages.some((message) => message.includes("Configured ghostty"))).toBe(true);
    expect(readFileSync(join(root, ".config/ghostty/config"), "utf8")).toContain("theme = dark:cassette-futurism-dark,light:cassette-futurism-light");
    expect(readFileSync(join(root, ".config/tmux/tmux.conf"), "utf8")).toContain("source-file");
    expect(readFileSync(join(root, ".config/tmux/tmux.conf"), "utf8")).not.toContain("zenith-dark.conf");
    expect(readFileSync(join(root, ".tmux/theme-tape.conf"), "utf8")).toContain("theme-tape managed");
    expect(readFileSync(join(root, ".tmux/theme-tape.conf"), "utf8")).toContain('status-style "bg=default,fg=#{@tape_fg}"');
    expect(readFileSync(join(root, ".tmux/theme-tape.conf"), "utf8")).toContain('@mode_indicator_empty_mode_style "fg=#{@tape_purple},bold"');
    expect(readFileSync(join(root, ".config/yazi/theme.toml"), "utf8")).toBe(renderYaziThemeToml("cassette-futurism"));
  });

  test("stores transparency config and applies opaque mode", () => {
    const root = mkdtempSync(join(tmpdir(), "theme-tape-opacity-"));
    created.push(root);

    applyTheme("zenith", "dark", undefined, {
      repoRoot: REPO_ROOT,
      homeDir: root,
      configHome: join(root, ".config"),
      dataHome: join(root, ".local", "share"),
      reloadTmux: false,
      refreshNeovim: false,
    });

    const result = setTransparencyMode("opaque", {
      repoRoot: REPO_ROOT,
      homeDir: root,
      configHome: join(root, ".config"),
      dataHome: join(root, ".local", "share"),
      reloadTmux: false,
      refreshNeovim: false,
    });

    expect(result.config.transparencyMode).toBe("opaque");
    expect(readThemeTapeConfig({
      repoRoot: REPO_ROOT,
      homeDir: root,
      configHome: join(root, ".config"),
      dataHome: join(root, ".local", "share"),
      reloadTmux: false,
      refreshNeovim: false,
    }).transparencyMode).toBe("opaque");
    expect(readFileSync(join(root, ".config/ghostty/config"), "utf8")).toContain("background-opacity = 1.0");
    expect(readFileSync(join(root, ".config/nvim/plugin/theme-tape.lua"), "utf8")).toContain('transparent = false');
    expect(readFileSync(join(root, ".tmux/theme-tape.conf"), "utf8")).toContain('status-style "bg=#{@tape_bg},fg=#{@tape_fg}"');
  });

  test("cassette tmux dark output uses a warmer analog palette", () => {
    const tmuxDark = readFileSync(join(REPO_ROOT, "themes/cassette-futurism/dist/tmux/cassette-futurism-dark.conf"), "utf8");

    expect(tmuxDark).toContain('set -g @tape_purple "#b08968"');
    expect(tmuxDark).toContain('set -g @tape_green "#7fb081"');
    expect(tmuxDark).toContain('set -g mode-style "bg=#{@tape_dark},fg=#{@tape_orange},bold"');
    expect(tmuxDark).toContain('set -g message-style "bg=#{@tape_dark},fg=#{@tape_green},border-style=double"');
  });
});
