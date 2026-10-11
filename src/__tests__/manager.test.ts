import {afterEach, beforeEach, describe, expect, test} from "bun:test";
import {mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {
  applyTheme,
  configureNvim,
  configureTargets,
  installThemeAssets,
  readThemeTapeConfig,
  renderDoctorReport,
  renderNeovimRemoteCommand,
  renderYaziThemeToml,
  setTransparencyMode,
} from "../manager";
import {REPO_ROOT, resolveThemeId, THEMES, THEME_ORDER} from "../theme-registry";
import {parseDocument} from "yaml";
const originalOmpEnv = {
  OMP_PROFILE: process.env.OMP_PROFILE,
  PI_PROFILE: process.env.PI_PROFILE,
  PI_CONFIG_DIR: process.env.PI_CONFIG_DIR,
  PI_CODING_AGENT_DIR: process.env.PI_CODING_AGENT_DIR,
};

function clearOmpEnv(): void {
  delete process.env.OMP_PROFILE;
  delete process.env.PI_PROFILE;
  delete process.env.PI_CONFIG_DIR;
  delete process.env.PI_CODING_AGENT_DIR;
}

function restoreOmpEnv(): void {
  clearOmpEnv();
  for (const [key, value] of Object.entries(originalOmpEnv)) {
    if (value !== undefined) {
      process.env[key] = value;
    }
  }
}
const created: string[] = [];

beforeEach(() => {
  clearOmpEnv();
});

afterEach(() => {
  restoreOmpEnv();
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

  test("installs warp theme assets only when explicitly requested", () => {
    const root = mkdtempSync(join(tmpdir(), "theme-tape-warp-install-"));
    created.push(root);

    installThemeAssets("all", ["warp"], {
      repoRoot: REPO_ROOT,
      homeDir: root,
      configHome: join(root, ".config"),
      dataHome: join(root, ".local", "share"),
      reloadTmux: false,
      refreshNeovim: false,
    });

    expect(realpathSync(join(root, ".warp/themes/zenith-dark.yaml"))).toBe(join(REPO_ROOT, "themes/zenith/dist/warp/zenith-dark.yaml"));
    expect(realpathSync(join(root, ".warp/themes/cassette-futurism-light.yaml"))).toBe(join(REPO_ROOT, "themes/cassette-futurism/dist/warp/cassette-futurism-light.yaml"));
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
    expect(readFileSync(join(root, ".config/nvim/lua/plugins/theme-tape.lua"), "utf8")).toContain('local mode = system_mode(read_state("theme_state", "dark"))');
    expect(readFileSync(join(root, ".config/nvim/lua/plugins/theme-tape.lua"), "utf8")).toContain('set_dark_mode = function()');
    expect(readFileSync(join(root, ".config/nvim/lua/plugins/theme-tape.lua"), "utf8")).toContain('lazy = false');
    expect(readFileSync(join(root, ".config/nvim/lua/plugins/theme-tape.lua"), "utf8")).toContain('require("auto-dark-mode").setup(opts)');
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

  test("renders a neovim refresh command that reapplies light mode setup", () => {
    const command = renderNeovimRemoteCommand("cassette-futurism", "light", "auto");

    expect(command).toContain("set background=light");
    expect(command).toContain('require("cassette-futurism").setup({ style = "light", transparent = true, dim_inactive = true })');
    expect(command).toContain("colorscheme cassette-futurism");
  });

  test("configures ghostty warp tmux and yazi paths dynamically", () => {
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
    expect(messages.some((message) => message.includes("Configured warp"))).toBe(false);
    expect(readFileSync(join(root, ".config/ghostty/config"), "utf8")).toContain("theme = dark:cassette-futurism-dark,light:cassette-futurism-light");
    expect(readFileSync(join(root, ".config/tmux/tmux.conf"), "utf8")).toContain("source-file");
    expect(readFileSync(join(root, ".config/tmux/tmux.conf"), "utf8")).not.toContain("zenith-dark.conf");
    const tmuxManagedConfig = readFileSync(join(root, ".tmux/theme-tape.conf"), "utf8");
    expect(tmuxManagedConfig).toContain("theme-tape managed");
    expect(tmuxManagedConfig).toContain(`source-file ${join(root, ".tmux/themes/cassette-futurism-dark.conf")}`);
    expect(tmuxManagedConfig).toContain(`source-file ${join(root, ".tmux/themes/cassette-futurism-light.conf")}`);
    expect(tmuxManagedConfig).toContain('grep -q dark ~/.tmux/theme_state');
    expect(tmuxManagedConfig).toContain('status-style "bg=default,fg=#{@tape_fg}"');
    expect(tmuxManagedConfig).toContain('@mode_indicator_empty_mode_style "bg=default,fg=#{@tape_purple},bold"');
    expect(tmuxManagedConfig).not.toContain("tmux source-file");
    expect(readFileSync(join(root, ".config/yazi/theme.toml"), "utf8")).toBe(renderYaziThemeToml("cassette-futurism"));
  });

  test("applies opencode theme assets and tui.json pointer", () => {
    const root = mkdtempSync(join(tmpdir(), "theme-tape-opencode-"));
    created.push(root);

    setTransparencyMode("opaque", {
      repoRoot: REPO_ROOT,
      homeDir: root,
      configHome: join(root, ".config"),
      dataHome: join(root, ".local", "share"),
      reloadTmux: false,
      refreshNeovim: false,
    });

    applyTheme("zenith", "light", undefined, {
      repoRoot: REPO_ROOT,
      homeDir: root,
      configHome: join(root, ".config"),
      dataHome: join(root, ".local", "share"),
      reloadTmux: false,
      refreshNeovim: false,
    });

    const tuiJson = JSON.parse(readFileSync(join(root, ".config/opencode/tui.json"), "utf8"));
    expect(tuiJson.theme).toBe("zenith-light");
    expect(tuiJson.$schema).toBe("https://opencode.ai/tui.json");
    const themeJson = JSON.parse(readFileSync(join(root, ".config/opencode/themes/zenith-light.json"), "utf8"));
    expect(themeJson.theme.text).toBeDefined();
    expect(themeJson.theme.background).not.toBe("none");
    expect(themeJson.theme.background).toMatch(/^#/);

    setTransparencyMode("transparent", {
      repoRoot: REPO_ROOT,
      homeDir: root,
      configHome: join(root, ".config"),
      dataHome: join(root, ".local", "share"),
      reloadTmux: false,
      refreshNeovim: false,
    });

    const transparentTheme = JSON.parse(
      readFileSync(join(root, ".config/opencode/themes/zenith-light.json"), "utf8"),
    );
    expect(transparentTheme.theme.background).toBe("none");
    expect(transparentTheme.theme.backgroundPanel).toBe("none");
    expect(transparentTheme.theme.backgroundElement).not.toBe("none");
    expect(transparentTheme.theme.backgroundElement).toMatch(/^#/);
    expect(transparentTheme.theme.backgroundMenu).not.toBe("none");
    expect(transparentTheme.theme.backgroundMenu).toMatch(/^#/);

    applyTheme("zenith", "dark", ["opencode"], {
      repoRoot: REPO_ROOT,
      homeDir: root,
      configHome: join(root, ".config"),
      dataHome: join(root, ".local", "share"),
      reloadTmux: false,
      refreshNeovim: false,
    });

    const transparentDarkTheme = JSON.parse(
      readFileSync(join(root, ".config/opencode/themes/zenith-dark.json"), "utf8"),
    );
    expect(transparentDarkTheme.theme.background).toBe("none");
    expect(transparentDarkTheme.theme.backgroundPanel).toBe("none");
    expect(transparentDarkTheme.theme.backgroundElement).toBe("#2e2e4a");
    expect(transparentDarkTheme.theme.backgroundMenu).toBe("#383860");
  });

  test("keeps opencode light themes opaque in auto transparency mode", () => {
    const root = mkdtempSync(join(tmpdir(), "theme-tape-opencode-auto-"));
    created.push(root);

    setTransparencyMode("auto", {
      repoRoot: REPO_ROOT,
      homeDir: root,
      configHome: join(root, ".config"),
      dataHome: join(root, ".local", "share"),
      reloadTmux: false,
      refreshNeovim: false,
    });

    applyTheme("cassette-futurism", "light", ["opencode"], {
      repoRoot: REPO_ROOT,
      homeDir: root,
      configHome: join(root, ".config"),
      dataHome: join(root, ".local", "share"),
      reloadTmux: false,
      refreshNeovim: false,
    });

    const lightTheme = JSON.parse(
      readFileSync(join(root, ".config/opencode/themes/cassette-futurism-light.json"), "utf8"),
    );
    expect(lightTheme.theme.background).not.toBe("none");
    expect(lightTheme.theme.backgroundPanel).not.toBe("none");

    applyTheme("cassette-futurism", "dark", ["opencode"], {
      repoRoot: REPO_ROOT,
      homeDir: root,
      configHome: join(root, ".config"),
      dataHome: join(root, ".local", "share"),
      reloadTmux: false,
      refreshNeovim: false,
    });

    const darkTheme = JSON.parse(
      readFileSync(join(root, ".config/opencode/themes/cassette-futurism-dark.json"), "utf8"),
    );
    expect(darkTheme.theme.background).toBe("none");
    expect(darkTheme.theme.backgroundPanel).toBe("none");
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

  test("light mode keeps black and muted text darker than the page", () => {
    const cassetteGhostty = readFileSync(join(REPO_ROOT, "themes/cassette-futurism/dist/ghostty/cassette-futurism-light"), "utf8");
    const cassetteTmux = readFileSync(join(REPO_ROOT, "themes/cassette-futurism/dist/tmux/cassette-futurism-light.conf"), "utf8");
    const zenithGhostty = readFileSync(join(REPO_ROOT, "themes/zenith/dist/ghostty/zenith-light"), "utf8");
    const zenithTmux = readFileSync(join(REPO_ROOT, "themes/zenith/dist/tmux/zenith-light.conf"), "utf8");

    expect(cassetteGhostty).toContain("palette = 0=#2d2a27");
    expect(cassetteGhostty).toContain("palette = 8=#2d2a27");
    expect(cassetteGhostty).toContain("palette = 255=#433f3b");
    expect(cassetteTmux).toContain('set -g @tape_gray "#2d2a27"');
    expect(cassetteTmux).toContain('set -g window-active-style "fg=#{@tape_fg},bg=default"');

    expect(zenithGhostty).toContain("palette = 0=#2a2840");
    expect(zenithGhostty).toContain("palette = 8=#2a2840");
    expect(zenithGhostty).toContain("palette = 255=#3c3954");
    expect(zenithTmux).toContain('set -g @tape_gray "#2a2840"');
    expect(zenithTmux).toContain('set -g window-active-style "fg=#{@tape_fg},bg=default"');
  });
  test("installs omp assets and preserves unrelated YAML while pairing both slots", () => {
    const root = mkdtempSync(join(tmpdir(), "theme-tape-omp-config-"));
    created.push(root);
    const agentDir = join(root, "omp-agent");
    mkdirSync(agentDir, {recursive: true});
    writeFileSync(
      join(agentDir, "config.yml"),
      [
        "# keep this comment",
        "models: {default: local, nested: {enabled: true}}",
        "theme:",
        "  dark: titanium",
        "  light: light",
        "nested:",
        "  keep: true",
        "",
      ].join("\n"),
      "utf8",
    );

    const options = {
      repoRoot: REPO_ROOT,
      homeDir: root,
      configHome: join(root, ".config"),
      dataHome: join(root, ".local", "share"),
      ompAgentDir: agentDir,
      reloadTmux: false,
      refreshNeovim: false,
    };
    applyTheme("cassette-futurism", "dark", ["omp"], options);

    const configPath = join(agentDir, "config.yml");
    const config = readFileSync(configPath, "utf8");
    expect(config).toContain("# keep this comment");
    const parsed = parseDocument(config).toJS() as {
      models: {default: string; nested: {enabled: boolean}};
      nested: {keep: boolean};
      theme: {dark: string; light: string};
    };
    expect(parsed.models).toEqual({default: "local", nested: {enabled: true}});
    expect(parsed.nested).toEqual({keep: true});
    expect(parsed.theme).toEqual({dark: "cassette-futurism-dark", light: "cassette-futurism-light"});

    applyTheme("cassette-futurism", "light", ["omp"], options);
    const switchedConfig = parseDocument(readFileSync(configPath, "utf8")).toJS() as typeof parsed;
    expect(switchedConfig.theme).toEqual({dark: "cassette-futurism-dark", light: "cassette-futurism-light"});

    applyTheme("zenith", "dark", ["omp"], options);
    const familyConfig = parseDocument(readFileSync(configPath, "utf8")).toJS() as typeof parsed;
    expect(familyConfig.theme).toEqual({dark: "zenith-dark", light: "zenith-light"});
  });

  test("rejects malformed omp YAML before changing config or state", () => {
    const root = mkdtempSync(join(tmpdir(), "theme-tape-omp-invalid-"));
    created.push(root);
    const agentDir = join(root, "omp-agent");
    mkdirSync(agentDir, {recursive: true});
    const configPath = join(agentDir, "config.yml");
    const malformed = "theme: [\n";
    writeFileSync(configPath, malformed, "utf8");

    expect(() => applyTheme("zenith", "dark", ["omp"], {
      repoRoot: REPO_ROOT,
      homeDir: root,
      configHome: join(root, ".config"),
      dataHome: join(root, ".local", "share"),
      ompAgentDir: agentDir,
      reloadTmux: false,
      refreshNeovim: false,
    })).toThrow(/Invalid omp config/);
    expect(readFileSync(configPath, "utf8")).toBe(malformed);
    expect(() => readFileSync(join(root, ".tmux/theme_name"), "utf8")).toThrow();
  });

  test("follows native profile precedence and explicit agent override conventions", () => {
    const root = mkdtempSync(join(tmpdir(), "theme-tape-omp-paths-"));
    created.push(root);
    const customAgent = join(root, "custom-agent");
    process.env.OMP_PROFILE = "work";
    process.env.PI_PROFILE = "legacy";
    process.env.PI_CONFIG_DIR = ".omp";
    process.env.PI_CODING_AGENT_DIR = customAgent;

    installThemeAssets("zenith", ["omp"], {
      repoRoot: REPO_ROOT,
      homeDir: root,
      configHome: join(root, ".config"),
      dataHome: join(root, ".local", "share"),
      reloadTmux: false,
      refreshNeovim: false,
    });

    const profileAgent = join(root, ".omp/profiles/work/agent");
    const profileConfig = parseDocument(readFileSync(join(profileAgent, "config.yml"), "utf8")).toJS() as {
      theme: {dark: string; light: string};
    };
    expect(profileConfig.theme).toEqual({dark: "zenith-dark", light: "zenith-light"});
    expect(() => readFileSync(join(customAgent, "config.yml"), "utf8")).toThrow();

    clearOmpEnv();
    process.env.PI_CODING_AGENT_DIR = customAgent;
    installThemeAssets("zenith", ["omp"], {
      repoRoot: REPO_ROOT,
      homeDir: root,
      configHome: join(root, ".config"),
      dataHome: join(root, ".local", "share"),
      reloadTmux: false,
      refreshNeovim: false,
    });
    const customConfig = parseDocument(readFileSync(join(customAgent, "config.yml"), "utf8")).toJS() as {
      theme: {dark: string; light: string};
    };
    expect(customConfig.theme).toEqual({dark: "zenith-dark", light: "zenith-light"});
    expect(parseDocument(readFileSync(join(profileAgent, "config.yml"), "utf8")).toJS()).toEqual(profileConfig);

  });
});
