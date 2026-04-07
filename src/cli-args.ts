import {type ApplyModeInput, type ApplyThemeInput, type ConfigureTarget, type InstallTarget, type TransparencyMode} from "./manager";

export type Command =
  | {kind: "interactive"}
  | {kind: "help"}
  | {kind: "state"}
  | {kind: "doctor"}
  | {kind: "build"}
  | {kind: "configure"; target: ConfigureTarget}
  | {kind: "config"; mode?: TransparencyMode}
  | {kind: "install"; theme: InstallTarget; components: string}
  | {kind: "apply"; theme: ApplyThemeInput; mode: ApplyModeInput; components: string};

export function parseArgs(argv: string[], currentTheme: ApplyThemeInput): Command {
  const [command, ...rest] = argv;
  if (!command) {
    return {kind: "interactive"};
  }

  if (command === "--help" || command === "-h" || command === "help") {
    return {kind: "help"};
  }

  if (command === "state") {
    return {kind: "state"};
  }

  if (command === "doctor") {
    return {kind: "doctor"};
  }

  if (command === "build") {
    return {kind: "build"};
  }

  if (command === "config") {
    const mode = rest[0] as TransparencyMode | undefined;
    if (mode && !["auto", "transparent", "opaque"].includes(mode)) {
      throw new Error(`Unknown transparency mode: ${mode}`);
    }

    return {kind: "config", mode};
  }

  if (command === "configure") {
    const target = (rest[0] ?? "all") as ConfigureTarget;
    if (!["all", "ghostty", "tmux", "nvim", "yazi"].includes(target)) {
      throw new Error(`Unknown configure target: ${target ?? ""}`);
    }

    return {kind: "configure", target};
  }

  if (command === "install") {
    return {
      kind: "install",
      theme: (readFlag(rest, "--theme") ?? "all") as InstallTarget,
      components: readFlag(rest, "--components") ?? "all",
    };
  }

  if (command === "apply") {
    return {
      kind: "apply",
      theme: (readFlag(rest, "--theme") ?? currentTheme) as ApplyThemeInput,
      mode: (readFlag(rest, "--mode") ?? "toggle") as ApplyModeInput,
      components: readFlag(rest, "--components") ?? "all",
    };
  }

  throw new Error(`Unknown command: ${command}`);
}

function readFlag(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}
