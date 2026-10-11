import {afterEach, describe, expect, test} from "bun:test";
import {spawnSync} from "node:child_process";
import {mkdtempSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {REPO_ROOT} from "../theme-registry";

const executable = Bun.which("tmux");
const version = executable ? spawnSync(executable, ["-V"], {encoding: "utf8"}).stdout : "";
const release = /tmux (\d+)\.(\d+)/.exec(version);
const hasNativeTheme = release && (Number(release[1]) > 3 || (Number(release[1]) === 3 && Number(release[2]) >= 8));
let directory: string | undefined;
let socket: string | undefined;

function tmux(...args: string[]): string {
  const result = spawnSync(executable!, ["-S", socket!, ...args], {encoding: "utf8", timeout: 10_000});
  if (result.status !== 0) {
    throw new Error(result.error?.message ?? result.stderr);
  }
  return result.stdout.trim();
}

function luminance(colour: string): number {
  const gray = /^gr[ae]y(\d+)$/.exec(colour);
  const hex = colour === "white" ? "#ffffff" : colour === "black" ? "#000000" : colour;
  const rgb = gray
    ? Array(3).fill(Math.round(Number(gray[1]) * 255 / 100)) as number[]
    : /^#[\da-f]{6}$/i.test(hex)
      ? [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16))
      : undefined;
  if (!rgb) throw new Error(`Unresolved tmux colour: ${colour}`);
  const [r, g, b] = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return r! * 0.2126 + g! * 0.7152 + b! * 0.0722;
}

function contrast(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function colour(option: string): string {
  return tmux("display-message", "-p", `#{E:${option}}`);
}

afterEach(() => {
  if (socket && executable) spawnSync(executable, ["-S", socket, "kill-server"]);
  if (directory) rmSync(directory, {recursive: true, force: true});
  socket = directory = undefined;
});

describe.skipIf(!hasNativeTheme)("tmux native chooser contrast", () => {
  for (const theme of ["cassette-futurism", "zenith"]) {
    test(`${theme} keeps chooser labels readable across light/dark switches`, () => {
      directory = mkdtempSync(join(tmpdir(), "theme-tape-tmux-"));
      socket = join(directory, "server.sock");
      tmux("-f", "/dev/null", "new-session", "-d", "-s", "contrast", "sleep 60");

      for (const mode of ["light", "dark", "light"]) {
        tmux("source-file", join(REPO_ROOT, "themes", theme, "dist", "tmux", `${theme}-${mode}.conf`));
        expect(tmux("show-options", "-sv", "theme")).toBe(mode);
        const page = colour("@tape_void");
        const surface = colour(`${mode}-theme-dark-grey`);
        for (const role of ["white", "light-grey"]) {
          const text = colour(`${mode}-theme-${role}`);
          const minimumContrast = role === "white" ? 7 : 4.5;
          expect(contrast(text, page)).toBeGreaterThanOrEqual(minimumContrast);
          expect(contrast(text, surface)).toBeGreaterThanOrEqual(minimumContrast);
        }
        for (const option of ["tree-mode-selection-style", "tree-mode-preview-style"]) {
          const style = colour(option);
          const foreground = /(?:^|,)fg=([^,]+)/.exec(style)?.[1];
          const background = /(?:^|,)bg=([^,]+)/.exec(style)?.[1];
          expect(contrast(foreground!, background!)).toBeGreaterThanOrEqual(7);
          // A selection is a theme surface, not a light/dark polarity inversion.
          const textPolarity = luminance(colour("@tape_fg")) - luminance(page);
          const selectionPolarity = luminance(foreground!) - luminance(background!);
          expect(selectionPolarity * textPolarity).toBeGreaterThan(0);
        }
      }
    });
  }
});
