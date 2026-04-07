import {afterEach, describe, expect, test} from "bun:test";
import {mkdtempSync, readFileSync, realpathSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {applyTheme, installThemeAssets, renderYaziThemeToml} from "../manager";
import {REPO_ROOT} from "../theme-registry";

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
});
