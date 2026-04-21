#!/usr/bin/env bun
import React from "react";
import {render} from "ink";
import {App} from "./app";
import {applyTheme, buildThemes, configureTargets, installThemeAssets, readState, readThemeTapeConfig, renderDoctorReport, setTransparencyMode} from "./manager";
import {parseArgs} from "./cli-args";
import {resolveComponents} from "./theme-registry";

function printHelp() {
  console.log(`theme-tape

Usage:
  theme-tape                 Launch the Ink TUI
  theme-tape state           Print the persisted theme state
  theme-tape doctor          Print real asset and install paths
  theme-tape build           Regenerate cassette-futurism and zenith outputs
  theme-tape config [auto|transparent|opaque]
  theme-tape configure [all|ghostty|tmux|nvim|yazi|opencode]
  theme-tape install [--theme all|cassette-futurism|zenith] [--components all|ghostty,tmux,nvim,yazi,opencode]
  theme-tape apply [--theme toggle|cassette|cassette-futurism|zenith] [--mode toggle|dark|light] [--components all|ghostty,tmux,nvim,yazi,opencode]

If --theme is omitted for apply, the current saved theme is preserved.
`);
}

async function main() {
  const command = parseArgs(process.argv.slice(2), readState().theme);

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

  if (command.kind === "doctor") {
    console.log(renderDoctorReport());
    return;
  }

  if (command.kind === "build") {
    buildThemes({logger: console.log});
    return;
  }

  if (command.kind === "config") {
    if (!command.mode) {
      console.log(JSON.stringify(readThemeTapeConfig(), null, 2));
      return;
    }

    const result = setTransparencyMode(command.mode);
    for (const message of result.messages) {
      console.log(message);
    }
    return;
  }

  if (command.kind === "configure") {
    for (const message of configureTargets(command.target)) {
      console.log(message);
    }
    return;
  }

  if (command.kind === "install") {
    installThemeAssets(command.theme, resolveComponents(command.components), {logger: console.log});
    return;
  }

  applyTheme(command.theme, command.mode, resolveComponents(command.components), {logger: console.log});
}

await main();
