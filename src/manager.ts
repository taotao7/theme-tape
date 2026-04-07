import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import {basename, dirname, join, resolve} from "node:path";
import {spawnSync} from "node:child_process";
import {
  DEFAULT_THEME_ID,
  ALL_COMPONENTS,
  type ComponentId,
  type Mode,
  REPO_ROOT,
  type ThemeId,
  THEMES,
  THEME_ORDER,
  resolveMode,
  resolveThemeId,
  toggleMode,
  toggleTheme,
} from "./theme-registry";

export interface ManagerOptions {
  repoRoot?: string;
  homeDir?: string;
  configHome?: string;
  dataHome?: string;
  runtimeDir?: string;
  dryRun?: boolean;
  reloadTmux?: boolean;
  refreshNeovim?: boolean;
  logger?: (message: string) => void;
}

export interface ThemeState {
  theme: ThemeId;
  mode: Mode;
}

export interface OperationResult {
  state?: ThemeState;
  messages: string[];
}

export interface DoctorPath {
  path: string;
  exists: boolean;
}

export interface DoctorThemeInfo {
  id: ThemeId;
  label: string;
  repoDir: DoctorPath;
  distDir: DoctorPath;
  ghosttyDarkAsset: DoctorPath;
  ghosttyLightAsset: DoctorPath;
  tmuxDarkAsset: DoctorPath;
  tmuxLightAsset: DoctorPath;
  nvimPluginAsset: DoctorPath;
  yaziDarkAsset: DoctorPath;
  yaziLightAsset: DoctorPath;
  ghosttyDarkLink: DoctorPath;
  ghosttyLightLink: DoctorPath;
  tmuxDarkLink: DoctorPath;
  tmuxLightLink: DoctorPath;
  nvimPluginLink: DoctorPath;
  yaziDarkLink: DoctorPath;
  yaziLightLink: DoctorPath;
}

export interface DoctorInfo {
  repoRoot: DoctorPath;
  homeDir: DoctorPath;
  configHome: DoctorPath;
  dataHome: DoctorPath;
  runtimeDir: DoctorPath;
  themeTapeConfig: DoctorPath;
  transparencyMode: TransparencyMode;
  ghosttyConfig: DoctorPath;
  tmuxConfig: DoctorPath;
  tmuxManagedConfig: DoctorPath;
  tmuxStateFile: DoctorPath;
  tmuxThemeNameFile: DoctorPath;
  yaziConfigRoot: DoctorPath;
  yaziThemeFile: DoctorPath;
  nvimConfigRoot: DoctorPath;
  nvimFlavor: NvimFlavor;
  nvimManagedConfig: DoctorPath;
  state: ThemeState;
  themes: DoctorThemeInfo[];
}

export type NvimFlavor = "astronvim" | "neovim";
export type ConfigureTarget = "ghostty" | "tmux" | "nvim" | "yazi" | "all";
export type TransparencyMode = "auto" | "transparent" | "opaque";

export interface ThemeTapeConfig {
  transparencyMode: TransparencyMode;
}

interface ResolvedOptions {
  repoRoot: string;
  homeDir: string;
  configHome: string;
  dataHome: string;
  runtimeDir: string;
  dryRun: boolean;
  reloadTmux: boolean;
  refreshNeovim: boolean;
  logger: (message: string) => void;
}

export type InstallTarget = ThemeId | "all";
export type ApplyThemeInput = ThemeId | "toggle";
export type ApplyModeInput = Mode | "toggle";

export function readState(options: ManagerOptions = {}): ThemeState {
  const resolved = resolveOptions(options);
  const tmuxDir = join(resolved.homeDir, ".tmux");
  const mode = readTextFile(join(tmuxDir, "theme_state")) || "dark";
  const theme = readTextFile(join(tmuxDir, "theme_name")) || DEFAULT_THEME_ID;

  return {
    theme: resolveThemeId(theme),
    mode: resolveMode(mode),
  };
}

export function readThemeTapeConfig(options: ManagerOptions = {}): ThemeTapeConfig {
  const resolved = resolveOptions(options);
  const configPath = detectThemeTapeConfigPath(resolved);
  if (!existsSync(configPath)) {
    return defaultThemeTapeConfig();
  }

  try {
    const parsed = JSON.parse(readFileSync(configPath, "utf8")) as Partial<ThemeTapeConfig>;
    return {
      transparencyMode: resolveTransparencyMode(parsed.transparencyMode),
    };
  } catch {
    return defaultThemeTapeConfig();
  }
}

export function writeThemeTapeConfig(
  config: Partial<ThemeTapeConfig>,
  options: ManagerOptions = {},
): {configPath: DoctorPath; config: ThemeTapeConfig} {
  const resolved = resolveOptions(options);
  const configPath = detectThemeTapeConfigPath(resolved);
  const nextConfig: ThemeTapeConfig = {
    ...readThemeTapeConfig(resolved),
    ...config,
    transparencyMode: resolveTransparencyMode(config.transparencyMode ?? readThemeTapeConfig(resolved).transparencyMode),
  };

  writeManagedFile(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, resolved);

  return {
    configPath: createDoctorPath(configPath),
    config: nextConfig,
  };
}

export function installThemeAssets(
  target: InstallTarget = "all",
  components: ComponentId[] = ALL_COMPONENTS,
  options: ManagerOptions = {},
): OperationResult {
  const resolved = resolveOptions(options);
  const selectedThemes = target === "all" ? Object.values(THEMES) : [THEMES[target]];
  const messages: string[] = [];

  for (const theme of selectedThemes) {
    if (components.includes("ghostty")) {
      const ghosttyDir = join(resolved.configHome, "ghostty", "themes");
      linkPath(join(theme.distDir, "ghostty", `${theme.ghosttyThemeBase}-dark`), join(ghosttyDir, `${theme.ghosttyThemeBase}-dark`), resolved);
      linkPath(join(theme.distDir, "ghostty", `${theme.ghosttyThemeBase}-light`), join(ghosttyDir, `${theme.ghosttyThemeBase}-light`), resolved);
      messages.push(`Ghostty assets ready for ${theme.id}`);
    }

    if (components.includes("tmux")) {
      const tmuxDir = join(resolved.homeDir, ".tmux", "themes");
      linkPath(join(theme.distDir, "tmux", `${theme.tmuxThemeBase}-dark.conf`), join(tmuxDir, `${theme.tmuxThemeBase}-dark.conf`), resolved);
      linkPath(join(theme.distDir, "tmux", `${theme.tmuxThemeBase}-light.conf`), join(tmuxDir, `${theme.tmuxThemeBase}-light.conf`), resolved);
      linkPath(join(theme.distDir, "tmux", "truecolor.conf"), join(tmuxDir, "truecolor.conf"), resolved);
      messages.push(`Tmux assets ready for ${theme.id}`);
    }

    if (components.includes("nvim")) {
      const nvimDir = join(resolved.dataHome, "nvim", "site", "pack", "theme-tape", "start");
      linkPath(join(theme.distDir, "nvim", theme.nvimPluginDir), join(nvimDir, theme.nvimPluginDir), resolved);
      messages.push(`Neovim plugin ready for ${theme.id}`);
    }

    if (components.includes("yazi")) {
      const yaziDir = join(resolved.configHome, "yazi", "flavors");
      linkPath(
        join(theme.distDir, "yazi", "flavors", `${theme.yaziFlavorBase}-dark.yazi`),
        join(yaziDir, `${theme.yaziFlavorBase}-dark.yazi`),
        resolved,
      );
      linkPath(
        join(theme.distDir, "yazi", "flavors", `${theme.yaziFlavorBase}-light.yazi`),
        join(yaziDir, `${theme.yaziFlavorBase}-light.yazi`),
        resolved,
      );
      messages.push(`Yazi flavors ready for ${theme.id}`);
    }
  }

  if (components.includes("nvim")) {
    const integration = configureNvim(resolved);
    messages.push(`Neovim config ready for ${integration.flavor}: ${integration.managedConfig.path}`);
  }

  if (components.includes("ghostty")) {
    const integration = configureGhostty(resolved);
    messages.push(`Ghostty config ready: ${integration.managedConfig.path}`);
  }

  if (components.includes("tmux")) {
    const integration = configureTmux(resolved);
    messages.push(`Tmux config ready: ${integration.managedConfig.path}`);
  }

  if (components.includes("yazi")) {
    const integration = configureYazi(resolved);
    messages.push(`Yazi config ready: ${integration.managedConfig.path}`);
  }

  for (const message of messages) {
    resolved.logger(message);
  }

  return {messages};
}

export function applyTheme(
  themeInput: ApplyThemeInput,
  modeInput: ApplyModeInput,
  components: ComponentId[] = ALL_COMPONENTS,
  options: ManagerOptions = {},
): OperationResult {
  const resolved = resolveOptions(options);
  const current = readState(resolved);
  const themeId = themeInput === "toggle" ? toggleTheme(current.theme) : resolveThemeId(themeInput);
  const mode = modeInput === "toggle" ? toggleMode(current.mode) : resolveMode(modeInput);
  const theme = THEMES[themeId];
  const messages: string[] = [];

  installThemeAssets(themeId, components, resolved);

  const tmuxDir = join(resolved.homeDir, ".tmux");
  writeManagedFile(join(tmuxDir, "theme_state"), `${mode}\n`, resolved);
  writeManagedFile(join(tmuxDir, "theme_name"), `${theme.id}\n`, resolved);
  messages.push(`State set to ${theme.id} (${mode})`);

  if (components.includes("ghostty")) {
    const ghosttyConfig = join(resolved.configHome, "ghostty", "config");
    upsertConfigLine(
      ghosttyConfig,
      /^theme\s*=.*$/m,
      `theme = dark:${theme.ghosttyThemeBase}-dark,light:${theme.ghosttyThemeBase}-light`,
      resolved,
    );
    messages.push(`Ghostty switched to ${theme.id}`);
  }

  if (components.includes("yazi")) {
    const yaziThemePath = join(resolved.configHome, "yazi", "theme.toml");
    writeManagedFile(yaziThemePath, renderYaziThemeToml(theme.id), resolved);
    messages.push(`Yazi switched to ${theme.id}`);
  }

  if (components.includes("tmux") && resolved.reloadTmux) {
    reloadTmux(theme.id, mode, resolved, messages);
  }

  if (components.includes("nvim") && resolved.refreshNeovim) {
    refreshNeovim(theme.id, mode, resolved, messages);
  }

  for (const message of messages) {
    resolved.logger(message);
  }

  return {
    state: {theme: theme.id, mode},
    messages,
  };
}

export function buildThemes(options: ManagerOptions = {}): OperationResult {
  const resolved = resolveOptions(options);
  const messages: string[] = [];
  const commands = [
    {cwd: resolve(resolved.repoRoot, "themes/cassette-futurism"), label: "cassette-futurism"},
    {cwd: resolve(resolved.repoRoot, "themes/zenith"), label: "zenith"},
  ];

  for (const command of commands) {
    if (resolved.dryRun) {
      const dryRunMessage = `Skipped python3 generate.py in ${command.cwd}`;
      messages.push(dryRunMessage);
      resolved.logger(dryRunMessage);
      continue;
    }

    runCommand("python3", ["generate.py"], command.cwd);
    const message = `Generated assets for ${command.label}`;
    messages.push(message);
    resolved.logger(message);
  }

  return {messages};
}

export function getDoctorInfo(options: ManagerOptions = {}): DoctorInfo {
  const resolved = resolveOptions(options);
  const state = readState(resolved);
  const config = readThemeTapeConfig(resolved);
  const ghosttyIntegration = detectGhosttyIntegration(resolved);
  const tmuxIntegration = detectTmuxIntegration(resolved);
  const yaziIntegration = detectYaziIntegration(resolved);
  const integration = detectNvimIntegration(resolved);
  const ghosttyThemesDir = join(resolved.configHome, "ghostty", "themes");
  const tmuxThemesDir = join(resolved.homeDir, ".tmux", "themes");
  const nvimDir = join(resolved.dataHome, "nvim", "site", "pack", "theme-tape", "start");
  const yaziFlavorsDir = join(resolved.configHome, "yazi", "flavors");

  return {
    repoRoot: createDoctorPath(resolved.repoRoot),
    homeDir: createDoctorPath(resolved.homeDir),
    configHome: createDoctorPath(resolved.configHome),
    dataHome: createDoctorPath(resolved.dataHome),
    runtimeDir: createDoctorPath(resolved.runtimeDir),
    themeTapeConfig: createDoctorPath(detectThemeTapeConfigPath(resolved)),
    transparencyMode: config.transparencyMode,
    ghosttyConfig: createDoctorPath(ghosttyIntegration.configPath),
    tmuxConfig: createDoctorPath(tmuxIntegration.configPath),
    tmuxManagedConfig: createDoctorPath(tmuxIntegration.managedConfigPath),
    tmuxStateFile: createDoctorPath(join(resolved.homeDir, ".tmux", "theme_state")),
    tmuxThemeNameFile: createDoctorPath(join(resolved.homeDir, ".tmux", "theme_name")),
    yaziConfigRoot: createDoctorPath(yaziIntegration.configRoot),
    yaziThemeFile: createDoctorPath(yaziIntegration.themePath),
    nvimConfigRoot: createDoctorPath(integration.configRoot),
    nvimFlavor: integration.flavor,
    nvimManagedConfig: createDoctorPath(integration.managedConfigPath),
    state,
    themes: THEME_ORDER.map((themeId) => {
      const theme = THEMES[themeId];
      return {
        id: theme.id,
        label: theme.label,
        repoDir: createDoctorPath(theme.repoDir),
        distDir: createDoctorPath(theme.distDir),
        ghosttyDarkAsset: createDoctorPath(join(theme.distDir, "ghostty", `${theme.ghosttyThemeBase}-dark`)),
        ghosttyLightAsset: createDoctorPath(join(theme.distDir, "ghostty", `${theme.ghosttyThemeBase}-light`)),
        tmuxDarkAsset: createDoctorPath(join(theme.distDir, "tmux", `${theme.tmuxThemeBase}-dark.conf`)),
        tmuxLightAsset: createDoctorPath(join(theme.distDir, "tmux", `${theme.tmuxThemeBase}-light.conf`)),
        nvimPluginAsset: createDoctorPath(join(theme.distDir, "nvim", theme.nvimPluginDir)),
        yaziDarkAsset: createDoctorPath(join(theme.distDir, "yazi", "flavors", `${theme.yaziFlavorBase}-dark.yazi`)),
        yaziLightAsset: createDoctorPath(join(theme.distDir, "yazi", "flavors", `${theme.yaziFlavorBase}-light.yazi`)),
        ghosttyDarkLink: createDoctorPath(join(ghosttyThemesDir, `${theme.ghosttyThemeBase}-dark`)),
        ghosttyLightLink: createDoctorPath(join(ghosttyThemesDir, `${theme.ghosttyThemeBase}-light`)),
        tmuxDarkLink: createDoctorPath(join(tmuxThemesDir, `${theme.tmuxThemeBase}-dark.conf`)),
        tmuxLightLink: createDoctorPath(join(tmuxThemesDir, `${theme.tmuxThemeBase}-light.conf`)),
        nvimPluginLink: createDoctorPath(join(nvimDir, theme.nvimPluginDir)),
        yaziDarkLink: createDoctorPath(join(yaziFlavorsDir, `${theme.yaziFlavorBase}-dark.yazi`)),
        yaziLightLink: createDoctorPath(join(yaziFlavorsDir, `${theme.yaziFlavorBase}-light.yazi`)),
      };
    }),
  };
}

export function renderDoctorReport(options: ManagerOptions = {}): string {
  const info = getDoctorInfo(options);
  const lines = [
    "theme-tape doctor",
    "",
    `Current state: ${info.state.theme} ${info.state.mode}`,
    `Repo root: ${formatDoctorPath(info.repoRoot)}`,
    `HOME: ${formatDoctorPath(info.homeDir)}`,
    `XDG_CONFIG_HOME: ${formatDoctorPath(info.configHome)}`,
    `XDG_DATA_HOME: ${formatDoctorPath(info.dataHome)}`,
    `XDG_RUNTIME_DIR: ${formatDoctorPath(info.runtimeDir)}`,
    `theme-tape config: ${formatDoctorPath(info.themeTapeConfig)}`,
    `transparency mode: ${info.transparencyMode}`,
    `ghostty config: ${formatDoctorPath(info.ghosttyConfig)}`,
    `tmux config: ${formatDoctorPath(info.tmuxConfig)}`,
    `tmux managed config: ${formatDoctorPath(info.tmuxManagedConfig)}`,
    `tmux theme_state: ${formatDoctorPath(info.tmuxStateFile)}`,
    `tmux theme_name: ${formatDoctorPath(info.tmuxThemeNameFile)}`,
    `yazi config root: ${formatDoctorPath(info.yaziConfigRoot)}`,
    `yazi theme.toml: ${formatDoctorPath(info.yaziThemeFile)}`,
    `nvim config root: ${formatDoctorPath(info.nvimConfigRoot)}`,
    `nvim flavor: ${info.nvimFlavor}`,
    `nvim managed config: ${formatDoctorPath(info.nvimManagedConfig)}`,
  ];

  for (const theme of info.themes) {
    lines.push(
      "",
      `[${theme.id}] ${theme.label}`,
      `  repo: ${formatDoctorPath(theme.repoDir)}`,
      `  dist: ${formatDoctorPath(theme.distDir)}`,
      `  ghostty asset dark: ${formatDoctorPath(theme.ghosttyDarkAsset)}`,
      `  ghostty asset light: ${formatDoctorPath(theme.ghosttyLightAsset)}`,
      `  ghostty install dark: ${formatDoctorPath(theme.ghosttyDarkLink)}`,
      `  ghostty install light: ${formatDoctorPath(theme.ghosttyLightLink)}`,
      `  tmux asset dark: ${formatDoctorPath(theme.tmuxDarkAsset)}`,
      `  tmux asset light: ${formatDoctorPath(theme.tmuxLightAsset)}`,
      `  tmux install dark: ${formatDoctorPath(theme.tmuxDarkLink)}`,
      `  tmux install light: ${formatDoctorPath(theme.tmuxLightLink)}`,
      `  neovim asset: ${formatDoctorPath(theme.nvimPluginAsset)}`,
      `  neovim install: ${formatDoctorPath(theme.nvimPluginLink)}`,
      `  yazi asset dark: ${formatDoctorPath(theme.yaziDarkAsset)}`,
      `  yazi asset light: ${formatDoctorPath(theme.yaziLightAsset)}`,
      `  yazi install dark: ${formatDoctorPath(theme.yaziDarkLink)}`,
      `  yazi install light: ${formatDoctorPath(theme.yaziLightLink)}`,
    );
  }

  return lines.join("\n");
}

export function configureNvim(options: ManagerOptions = {}): {flavor: NvimFlavor; managedConfig: DoctorPath} {
  const resolved = resolveOptions(options);
  const integration = detectNvimIntegration(resolved);
  const config = readThemeTapeConfig(resolved);
  const transparency = resolveThemeTransparency(config.transparencyMode);
  const content = integration.flavor === "astronvim"
    ? renderAstroNvimIntegration(transparency)
    : renderStandardNvimIntegration(transparency);

  writeManagedFile(integration.managedConfigPath, content, resolved);

  return {
    flavor: integration.flavor,
    managedConfig: createDoctorPath(integration.managedConfigPath),
  };
}

export function configureGhostty(options: ManagerOptions = {}): {managedConfig: DoctorPath} {
  const resolved = resolveOptions(options);
  const state = readState(resolved);
  const config = readThemeTapeConfig(resolved);
  const integration = detectGhosttyIntegration(resolved);
  const theme = THEMES[state.theme];

  upsertConfigLine(
    integration.configPath,
    /^theme\s*=.*$/m,
    `theme = dark:${theme.ghosttyThemeBase}-dark,light:${theme.ghosttyThemeBase}-light`,
    resolved,
  );
  if (config.transparencyMode === "opaque") {
    upsertConfigLine(integration.configPath, /^background-opacity\s*=.*$/m, "background-opacity = 1.0", resolved);
    upsertConfigLine(integration.configPath, /^background-blur-radius\s*=.*$/m, "background-blur-radius = 0", resolved);
  } else {
    upsertConfigLine(integration.configPath, /^background-opacity\s*=.*$/m, "background-opacity = 0.92", resolved);
    upsertConfigLine(integration.configPath, /^background-blur-radius\s*=.*$/m, "background-blur-radius = 20", resolved);
  }

  return {
    managedConfig: createDoctorPath(integration.configPath),
  };
}

export function configureTmux(options: ManagerOptions = {}): {managedConfig: DoctorPath} {
  const resolved = resolveOptions(options);
  const integration = detectTmuxIntegration(resolved);
  const config = readThemeTapeConfig(resolved);

  writeManagedFile(integration.managedConfigPath, renderTmuxManagedConfig(config.transparencyMode), resolved);
  upsertManagedBlock(
    integration.configPath,
    "# theme-tape managed begin",
    "# theme-tape managed end",
    `source-file ${integration.managedConfigPath}`,
    resolved,
  );

  return {
    managedConfig: createDoctorPath(integration.managedConfigPath),
  };
}

export function configureYazi(options: ManagerOptions = {}): {managedConfig: DoctorPath} {
  const resolved = resolveOptions(options);
  const state = readState(resolved);
  const integration = detectYaziIntegration(resolved);

  writeManagedFile(integration.themePath, renderYaziThemeToml(state.theme), resolved);

  return {
    managedConfig: createDoctorPath(integration.themePath),
  };
}

export function configureTargets(target: ConfigureTarget = "all", options: ManagerOptions = {}): string[] {
  const resolved = resolveOptions(options);
  const targets = target === "all" ? ALL_COMPONENTS : [target];
  const messages: string[] = [];

  for (const component of targets) {
    if (component === "ghostty") {
      messages.push(`Configured ghostty: ${configureGhostty(resolved).managedConfig.path}`);
    } else if (component === "tmux") {
      messages.push(`Configured tmux: ${configureTmux(resolved).managedConfig.path}`);
    } else if (component === "nvim") {
      const result = configureNvim(resolved);
      messages.push(`Configured ${result.flavor}: ${result.managedConfig.path}`);
    } else if (component === "yazi") {
      messages.push(`Configured yazi: ${configureYazi(resolved).managedConfig.path}`);
    }
  }

  return messages;
}

export function setTransparencyMode(
  mode: TransparencyMode,
  options: ManagerOptions = {},
): {configPath: DoctorPath; config: ThemeTapeConfig; messages: string[]} {
  const resolved = resolveOptions(options);
  const result = writeThemeTapeConfig({transparencyMode: mode}, resolved);
  const messages = [
    `Updated transparency mode: ${result.config.transparencyMode}`,
    ...configureTargets("all", resolved),
  ];

  return {
    ...result,
    messages,
  };
}

export function renderYaziThemeToml(themeId: ThemeId): string {
  return [
    "# theme-tape managed",
    "[flavor]",
    `dark  = "${themeId}-dark"`,
    `light = "${themeId}-light"`,
    "",
  ].join("\n");
}

function resolveOptions(options: ManagerOptions = {}): ResolvedOptions {
  const homeDir = options.homeDir ?? process.env.HOME ?? "";
  if (!homeDir) {
    throw new Error("HOME is not set");
  }

  return {
    repoRoot: options.repoRoot ?? REPO_ROOT,
    homeDir,
    configHome: options.configHome ?? process.env.XDG_CONFIG_HOME ?? join(homeDir, ".config"),
    dataHome: options.dataHome ?? process.env.XDG_DATA_HOME ?? join(homeDir, ".local", "share"),
    runtimeDir: options.runtimeDir ?? process.env.XDG_RUNTIME_DIR ?? "/tmp",
    dryRun: options.dryRun ?? false,
    reloadTmux: options.reloadTmux ?? true,
    refreshNeovim: options.refreshNeovim ?? true,
    logger: options.logger ?? (() => {}),
  };
}

function writeManagedFile(filePath: string, content: string, options: ResolvedOptions): void {
  mkdirPath(dirname(filePath), options);
  if (options.dryRun) {
    return;
  }

  writeFileSync(filePath, content, "utf8");
}

function upsertConfigLine(filePath: string, matcher: RegExp, replacement: string, options: ResolvedOptions): void {
  const current = existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
  const next = matcher.test(current)
    ? current.replace(matcher, replacement)
    : `${current.replace(/\s*$/, "")}${current.trim().length > 0 ? "\n" : ""}${replacement}\n`;

  writeManagedFile(filePath, next, options);
}

function upsertManagedBlock(
  filePath: string,
  startMarker: string,
  endMarker: string,
  body: string,
  options: ResolvedOptions,
): void {
  const current = existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
  const block = `${startMarker}\n${body}\n${endMarker}`;
  const escapedStart = escapeRegExp(startMarker);
  const escapedEnd = escapeRegExp(endMarker);
  const matcher = new RegExp(`${escapedStart}[\\s\\S]*?${escapedEnd}`, "m");
  const next = matcher.test(current)
    ? current.replace(matcher, block)
    : `${current.replace(/\s*$/, "")}${current.trim().length > 0 ? "\n\n" : ""}${block}\n`;

  writeManagedFile(filePath, next, options);
}

function linkPath(source: string, target: string, options: ResolvedOptions): void {
  if (!existsSync(source)) {
    throw new Error(`Missing generated asset: ${source}`);
  }

  mkdirPath(dirname(target), options);
  if (options.dryRun) {
    return;
  }

  rmSync(target, {force: true, recursive: true});
  symlinkSync(source, target);
}

function mkdirPath(dirPath: string, options: ResolvedOptions): void {
  if (options.dryRun) {
    return;
  }

  mkdirSync(dirPath, {recursive: true});
}

function readTextFile(filePath: string): string | undefined {
  if (!existsSync(filePath)) {
    return undefined;
  }

  return readFileSync(filePath, "utf8").trim() || undefined;
}

function createDoctorPath(path: string): DoctorPath {
  return {
    path,
    exists: existsSync(path),
  };
}

function formatDoctorPath(item: DoctorPath): string {
  return `${item.path} (${item.exists ? "exists" : "missing"})`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function detectThemeTapeConfigPath(options: ResolvedOptions): string {
  return join(options.configHome, "theme-tape", "config.json");
}

function defaultThemeTapeConfig(): ThemeTapeConfig {
  return {
    transparencyMode: "auto",
  };
}

function resolveTransparencyMode(value: string | undefined): TransparencyMode {
  if (value === "transparent" || value === "opaque" || value === "auto") {
    return value;
  }

  return defaultThemeTapeConfig().transparencyMode;
}

function resolveThemeTransparency(mode: TransparencyMode): {zenith: boolean; cassette: boolean} {
  if (mode === "transparent") {
    return {zenith: true, cassette: true};
  }

  if (mode === "opaque") {
    return {zenith: false, cassette: false};
  }

  return {zenith: true, cassette: false};
}

function detectGhosttyIntegration(options: ResolvedOptions): {
  configRoot: string;
  configPath: string;
} {
  const configRoot = join(options.configHome, "ghostty");
  return {
    configRoot,
    configPath: join(configRoot, "config"),
  };
}

function detectTmuxIntegration(options: ResolvedOptions): {
  configPath: string;
  managedConfigPath: string;
} {
  const xdgConfigPath = join(options.configHome, "tmux", "tmux.conf");
  const homeConfigPath = join(options.homeDir, ".tmux.conf");

  return {
    configPath: existsSync(xdgConfigPath) || !existsSync(homeConfigPath) ? xdgConfigPath : homeConfigPath,
    managedConfigPath: join(options.homeDir, ".tmux", "theme-tape.conf"),
  };
}

function detectYaziIntegration(options: ResolvedOptions): {
  configRoot: string;
  themePath: string;
} {
  const configRoot = join(options.configHome, "yazi");
  return {
    configRoot,
    themePath: join(configRoot, "theme.toml"),
  };
}

function detectNvimIntegration(options: ResolvedOptions): {
  flavor: NvimFlavor;
  configRoot: string;
  managedConfigPath: string;
} {
  const configRoot = join(options.configHome, "nvim");
  const astroPluginPath = join(configRoot, "lua", "plugins", "theme-tape.lua");

  if (existsSync(join(configRoot, "lua", "lazy_setup.lua"))) {
    return {
      flavor: "astronvim",
      configRoot,
      managedConfigPath: astroPluginPath,
    };
  }

  return {
    flavor: "neovim",
    configRoot,
    managedConfigPath: join(configRoot, "plugin", "theme-tape.lua"),
  };
}

function renderStandardNvimIntegration(transparency: {zenith: boolean; cassette: boolean}): string {
  return [
    'local function read_state(name, default)',
    '  local path = vim.fn.expand("~/.tmux/" .. name)',
    '  local ok, lines = pcall(vim.fn.readfile, path)',
    '  if not ok or not lines[1] or lines[1] == "" then return default end',
    '  return lines[1]',
    'end',
    '',
    'local theme = read_state("theme_name", "zenith")',
    'local mode = read_state("theme_state", "dark")',
    'local theme_root = vim.fn.stdpath("data") .. "/site/pack/theme-tape/start"',
    '',
    'vim.opt.runtimepath:append(theme_root .. "/zenith.nvim")',
    'vim.opt.runtimepath:append(theme_root .. "/cassette-futurism.nvim")',
    'vim.o.background = mode',
    '',
    'if theme == "cassette-futurism" then',
    `  require("cassette-futurism").setup({ style = mode, transparent = ${transparency.cassette ? "true" : "false"}, dim_inactive = true })`,
    '  vim.cmd.colorscheme("cassette-futurism")',
    'else',
    `  require("zenith").setup({ style = mode, transparent = ${transparency.zenith ? "true" : "false"}, dim_inactive = true })`,
    '  vim.cmd.colorscheme("zenith")',
    'end',
    '',
  ].join("\n");
}

function renderAstroNvimIntegration(transparency: {zenith: boolean; cassette: boolean}): string {
  return [
    'local function read_state(name, default)',
    '  local path = vim.fn.expand("~/.tmux/" .. name)',
    '  local ok, lines = pcall(vim.fn.readfile, path)',
    '  if not ok or not lines[1] or lines[1] == "" then return default end',
    '  return lines[1]',
    'end',
    '',
    'local theme = read_state("theme_name", "zenith")',
    'local mode = read_state("theme_state", "dark")',
    'local theme_root = vim.fn.stdpath("data") .. "/site/pack/theme-tape/start"',
    '',
    'local function current_status_color()',
    '  if theme == "cassette-futurism" then',
    '    return mode == "light" and "#d65d0e" or "#ffb86c"',
    '  end',
    '  return "#b070e8"',
    'end',
    '',
    'local function apply_theme()',
    '  vim.o.background = mode',
    '  if theme == "cassette-futurism" then',
    `    require("cassette-futurism").setup({ style = mode, transparent = ${transparency.cassette ? "true" : "false"}, dim_inactive = true })`,
    '    vim.cmd.colorscheme("cassette-futurism")',
    '  else',
    `    require("zenith").setup({ style = mode, transparent = ${transparency.zenith ? "true" : "false"}, dim_inactive = true })`,
    '    vim.cmd.colorscheme("zenith")',
    '  end',
    'end',
    '',
    'return {',
    '  {',
    '    dir = theme_root .. "/zenith.nvim",',
    '    name = "zenith",',
    '    lazy = false,',
    '    priority = 1000,',
    '    config = function()',
    '      if theme == "zenith" then apply_theme() end',
    '    end,',
    '  },',
    '  {',
    '    dir = theme_root .. "/cassette-futurism.nvim",',
    '    name = "cassette-futurism",',
    '    lazy = false,',
    '    priority = 1000,',
    '    config = function()',
    '      if theme == "cassette-futurism" then apply_theme() end',
    '    end,',
    '  },',
    '  {',
    '    "AstroNvim/astroui",',
    '    opts = function(_, opts)',
    '      opts.colorscheme = theme',
    '      opts.status = opts.status or {}',
    '      local prev_colors = opts.status.colors',
    '      opts.status.colors = function(colors)',
    '        if type(prev_colors) == "function" then',
    '          colors = prev_colors(colors) or colors',
    '        end',
    '        colors.normal = current_status_color()',
    '        colors.bg = "NONE"',
    '        colors.section_bg = "NONE"',
    '        return colors',
    '      end',
    '    end,',
    '  },',
    '  {',
    '    "f-person/auto-dark-mode.nvim",',
    '    enabled = false,',
    '  },',
    '}',
    '',
  ].join("\n");
}

function renderTmuxManagedConfig(transparencyMode: TransparencyMode): string {
  const opacityLine = transparencyMode === "opaque"
    ? "run-shell 'if [ \"$(cat ~/.tmux/theme_state 2>/dev/null || echo dark)\" = \"dark\" ]; then tmux set -g status-style \"bg=#{@tape_void},fg=#{@tape_fg}\"; fi'"
    : "run-shell 'if [ \"$(cat ~/.tmux/theme_state 2>/dev/null || echo dark)\" = \"dark\" ]; then tmux set -g status-style \"bg=default,fg=#{@tape_fg}\"; fi'";

  return [
    "# theme-tape managed",
    "if-shell \"test ! -f ~/.tmux/theme_state\" \"run-shell 'mkdir -p ~/.tmux && echo dark > ~/.tmux/theme_state'\"",
    `if-shell "test ! -f ~/.tmux/theme_name" "run-shell 'mkdir -p ~/.tmux && echo ${DEFAULT_THEME_ID} > ~/.tmux/theme_name'"`,
    "if-shell \"test -f ~/.tmux/themes/truecolor.conf\" \"source-file ~/.tmux/themes/truecolor.conf\"",
    `run-shell 'theme=$(cat ~/.tmux/theme_name 2>/dev/null || echo ${DEFAULT_THEME_ID}); mode=$(cat ~/.tmux/theme_state 2>/dev/null || echo dark); theme_file="$HOME/.tmux/themes/\${theme}-\${mode}.conf"; if [ -f "$theme_file" ]; then tmux source-file "$theme_file"; fi'`,
    opacityLine,
    "",
  ].join("\n");
}

function runCommand(command: string, args: string[], cwd: string): void {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed in ${cwd}`);
  }
}

function reloadTmux(themeId: ThemeId, mode: Mode, options: ResolvedOptions, messages: string[]): void {
  const tmuxList = spawnSync("tmux", ["list-sessions"], {stdio: "ignore"});
  if (tmuxList.status !== 0 || tmuxList.error) {
    messages.push("Tmux not running; state saved");
    return;
  }

  if (options.dryRun) {
    messages.push("Tmux reload skipped (dry-run)");
    return;
  }

  const integration = detectTmuxIntegration(options);
  spawnSync("tmux", ["source-file", integration.configPath], {stdio: "ignore"});
  const label = `${themeId.toUpperCase()} ${mode.toUpperCase()}`;
  spawnSync("tmux", ["display-message", ` ${label}`], {stdio: "ignore"});
  messages.push(`Tmux switched to ${themeId}`);
}

function refreshNeovim(themeId: ThemeId, mode: Mode, options: ResolvedOptions, messages: string[]): void {
  if (options.dryRun) {
    messages.push("Neovim refresh skipped (dry-run)");
    return;
  }

  const sockets = listNvimSockets(options.runtimeDir);
  if (sockets.length === 0) {
    messages.push("Neovim sockets not found; state saved");
    return;
  }

  const command = `set background=${mode} | colorscheme ${THEMES[themeId].nvimColorscheme}`;
  for (const socket of sockets) {
    spawnSync("nvim", ["--server", socket, "--remote-send", `<Cmd>${command}<CR>`], {stdio: "ignore"});
  }

  messages.push(`Neovim switched to ${themeId}`);
}

function listNvimSockets(runtimeDir: string): string[] {
  const bases = new Set<string>(["/tmp", runtimeDir]);
  const sockets: string[] = [];

  for (const base of bases) {
    if (!base || !existsSync(base)) {
      continue;
    }

    for (const entry of readdirSync(base, {withFileTypes: true})) {
      if (!entry.isDirectory() || !entry.name.startsWith("nvim.")) {
        continue;
      }

      const socket = join(base, entry.name, "0");
      if (existsSync(socket)) {
        sockets.push(socket);
      }
    }
  }

  return Array.from(new Set(sockets)).sort((left, right) => basename(left).localeCompare(basename(right)));
}
