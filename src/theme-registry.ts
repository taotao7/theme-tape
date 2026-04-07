import {existsSync, readdirSync, readFileSync, realpathSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

export type ThemeId = string;
export type Mode = "dark" | "light";
export type ComponentId = "ghostty" | "tmux" | "nvim" | "yazi";

interface ThemeManifest {
  id: string;
  label: string;
  aliases?: string[];
  order?: number;
  ghosttyThemeBase: string;
  tmuxThemeBase: string;
  nvimPluginDir: string;
  nvimColorscheme: string;
  yaziFlavorBase: string;
}

export interface ThemeSpec {
  id: ThemeId;
  label: string;
  repoDir: string;
  distDir: string;
  aliases: string[];
  order: number;
  ghosttyThemeBase: string;
  tmuxThemeBase: string;
  nvimPluginDir: string;
  nvimColorscheme: string;
  yaziFlavorBase: string;
}

const sourceDir = dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = resolveRepoRoot();
export const ALL_COMPONENTS: ComponentId[] = ["ghostty", "tmux", "nvim", "yazi"];
export const THEMES = loadThemes(REPO_ROOT);
export const THEME_ORDER = Object.values(THEMES)
  .sort((left, right) => left.order - right.order || left.label.localeCompare(right.label))
  .map((theme) => theme.id);
export const DEFAULT_THEME_ID = THEMES.zenith ? "zenith" : THEME_ORDER[0];

const THEME_ALIASES = Object.values(THEMES).reduce<Record<string, ThemeId>>((aliases, theme) => {
  aliases[theme.id] = theme.id;
  for (const alias of theme.aliases) {
    aliases[alias] = theme.id;
  }
  return aliases;
}, {});

export function resolveThemeId(input: string): ThemeId {
  const theme = THEME_ALIASES[input];
  if (!theme) {
    throw new Error(`Unknown theme: ${input}`);
  }

  return theme;
}

export function toggleTheme(theme: ThemeId): ThemeId {
  if (THEME_ORDER.length === 0) {
    throw new Error("No themes available");
  }

  const currentIndex = THEME_ORDER.indexOf(theme);
  if (currentIndex === -1) {
    return THEME_ORDER[0];
  }

  return THEME_ORDER[(currentIndex + 1) % THEME_ORDER.length];
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
  const themesDir = join(root, "themes");
  if (!existsSync(themesDir)) {
    return false;
  }

  try {
    return readdirSync(themesDir, {withFileTypes: true}).some(
      (entry) => entry.isDirectory() && existsSync(join(themesDir, entry.name, "theme.json")),
    );
  } catch {
    return false;
  }
}

function loadThemes(root: string): Record<ThemeId, ThemeSpec> {
  const themesDir = join(root, "themes");
  const themes = readdirSync(themesDir, {withFileTypes: true})
    .filter((entry) => entry.isDirectory())
    .map((entry) => loadTheme(join(themesDir, entry.name)));

  if (themes.length === 0) {
    throw new Error(`No themes found in ${themesDir}`);
  }

  return themes.reduce<Record<ThemeId, ThemeSpec>>((registry, theme) => {
    registry[theme.id] = theme;
    return registry;
  }, {});
}

function loadTheme(themeDir: string): ThemeSpec {
  const manifestPath = join(themeDir, "theme.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as ThemeManifest;

  return {
    ...manifest,
    aliases: manifest.aliases ?? [],
    order: manifest.order ?? Number.MAX_SAFE_INTEGER,
    repoDir: themeDir,
    distDir: join(themeDir, "dist"),
  };
}
