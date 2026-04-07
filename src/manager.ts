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
  ALL_COMPONENTS,
  type ComponentId,
  type Mode,
  REPO_ROOT,
  type ThemeId,
  THEMES,
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
export type ApplyThemeInput = ThemeId | "cassette" | "zenith" | "cassette-futurism" | "toggle";
export type ApplyModeInput = Mode | "toggle";

export function readState(options: ManagerOptions = {}): ThemeState {
  const resolved = resolveOptions(options);
  const tmuxDir = join(resolved.homeDir, ".tmux");
  const mode = readTextFile(join(tmuxDir, "theme_state")) || "dark";
  const theme = readTextFile(join(tmuxDir, "theme_name")) || "zenith";

  return {
    theme: resolveThemeId(theme),
    mode: resolveMode(mode),
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

  spawnSync("tmux", ["source-file", join(options.homeDir, ".tmux.conf")], {stdio: "ignore"});
  const label = themeId === "zenith" ? `ZENITH ${mode.toUpperCase()}` : `CASSETTE ${mode.toUpperCase()}`;
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
