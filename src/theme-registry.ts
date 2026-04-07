import {existsSync, realpathSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

export type ThemeId = "cassette-futurism" | "zenith";
export type Mode = "dark" | "light";
export type ComponentId = "ghostty" | "tmux" | "nvim" | "yazi";

export interface ThemeSpec {
  id: ThemeId;
  label: string;
  repoDir: string;
  distDir: string;
  ghosttyThemeBase: string;
  tmuxThemeBase: string;
  nvimPluginDir: string;
  nvimColorscheme: string;
  yaziFlavorBase: string;
}

const sourceDir = dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = resolveRepoRoot();
export const ALL_COMPONENTS: ComponentId[] = ["ghostty", "tmux", "nvim", "yazi"];
export const THEME_ORDER: ThemeId[] = ["cassette-futurism", "zenith"];

export const THEMES: Record<ThemeId, ThemeSpec> = {
  "cassette-futurism": {
    id: "cassette-futurism",
    label: "Cassette Futurism",
    repoDir: resolve(REPO_ROOT, "themes/cassette-futurism"),
    distDir: resolve(REPO_ROOT, "themes/cassette-futurism/dist"),
    ghosttyThemeBase: "cassette-futurism",
    tmuxThemeBase: "cassette-futurism",
    nvimPluginDir: "cassette-futurism.nvim",
    nvimColorscheme: "cassette-futurism",
    yaziFlavorBase: "cassette-futurism",
  },
  zenith: {
    id: "zenith",
    label: "Zenith",
    repoDir: resolve(REPO_ROOT, "themes/zenith"),
    distDir: resolve(REPO_ROOT, "themes/zenith/dist"),
    ghosttyThemeBase: "zenith",
    tmuxThemeBase: "zenith",
    nvimPluginDir: "zenith.nvim",
    nvimColorscheme: "zenith",
    yaziFlavorBase: "zenith",
  },
};

const THEME_ALIASES: Record<string, ThemeId> = {
  cassette: "cassette-futurism",
  "cassette-futurism": "cassette-futurism",
  zenith: "zenith",
};

export function resolveThemeId(input: string): ThemeId {
  const theme = THEME_ALIASES[input];
  if (!theme) {
    throw new Error(`Unknown theme: ${input}`);
  }

  return theme;
}

export function toggleTheme(theme: ThemeId): ThemeId {
  return theme === "cassette-futurism" ? "zenith" : "cassette-futurism";
}

export function toggleMode(mode: Mode): Mode {
  return mode === "dark" ? "light" : "dark";
}

export function resolveMode(input: string): Mode {
  if (input !== "dark" && input !== "light") {
    throw new Error(`Unknown mode: ${input}`);
  }

  return input;
}

export function resolveComponents(raw?: string): ComponentId[] {
  if (!raw || raw === "all") {
    return [...ALL_COMPONENTS];
  }

  const components = raw
    .split(",")
    .map((component) => component.trim())
    .filter(Boolean);

  if (components.length === 0) {
    return [...ALL_COMPONENTS];
  }

  for (const component of components) {
    if (!ALL_COMPONENTS.includes(component as ComponentId)) {
      throw new Error(`Unknown component: ${component}`);
    }
  }

  return components as ComponentId[];
}

function resolveRepoRoot(): string {
  const envRoot = process.env.THEME_TAPE_ROOT;
  if (envRoot && hasThemes(envRoot)) {
    return envRoot;
  }

  const executablePath = resolveExecutablePath();
  const executableRoot = resolve(executablePath, "..", "..");
  if (hasThemes(executableRoot)) {
    return executableRoot;
  }

  const homebrewRoot = join(executableRoot, "share", "theme-tape");
  if (hasThemes(homebrewRoot)) {
    return homebrewRoot;
  }

  const cwdRoot = process.cwd();
  if (hasThemes(cwdRoot)) {
    return cwdRoot;
  }

  const sourceRoot = resolve(sourceDir, "..");
  if (hasThemes(sourceRoot)) {
    return sourceRoot;
  }

  return sourceRoot;
}

function resolveExecutablePath(): string {
  try {
    return realpathSync(process.execPath);
  } catch {
    return process.execPath;
  }
}

function hasThemes(root: string): boolean {
  return existsSync(join(root, "themes", "cassette-futurism")) && existsSync(join(root, "themes", "zenith"));
}
