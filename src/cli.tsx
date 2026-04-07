#!/usr/bin/env bun
import React from "react";
import {render} from "ink";
import {App} from "./app";
import {applyTheme, buildThemes, installThemeAssets, readState} from "./manager";
import {type ApplyModeInput, type ApplyThemeInput, type InstallTarget} from "./manager";
import {resolveComponents} from "./theme-registry";

type Command =
  | {kind: "interactive"}
  | {kind: "help"}
  | {kind: "state"}
  | {kind: "build"}
  | {kind: "install"; theme: "all" | "cassette-futurism" | "zenith"; components: string}
  | {kind: "apply"; theme: "toggle" | "cassette-futurism" | "zenith" | "cassette"; mode: "toggle" | "dark" | "light"; components: string};

function parseArgs(argv: string[]): Command {
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

  if (command === "build") {
    return {kind: "build"};
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
      theme: (readFlag(rest, "--theme") ?? "toggle") as ApplyThemeInput,
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

function printHelp() {
  console.log(`theme-tape

Usage:
  theme-tape                 Launch the Ink TUI
  theme-tape state           Print the persisted theme state
  theme-tape build           Regenerate cassette-futurism and zenith outputs
  theme-tape install [--theme all|cassette-futurism|zenith] [--components all|ghostty,tmux,nvim,yazi]
  theme-tape apply [--theme toggle|cassette|cassette-futurism|zenith] [--mode toggle|dark|light] [--components all|ghostty,tmux,nvim,yazi]
`);
}

async function main() {
  const command = parseArgs(process.argv.slice(2));

  if (command.kind === "interactive") {
    render(<App />);
    return;
  }

  if (command.kind === "help") {
    printHelp();
    return;
  }

  if (command.kind === "state") {
    const state = readState();
    console.log(`${state.theme} ${state.mode}`);
    return;
  }

  if (command.kind === "build") {
    buildThemes({logger: console.log});
    return;
  }

  if (command.kind === "install") {
    installThemeAssets(command.theme, resolveComponents(command.components), {logger: console.log});
    return;
  }

  applyTheme(command.theme, command.mode, resolveComponents(command.components), {logger: console.log});
}

await main();
