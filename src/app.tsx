import React, {useMemo, useState} from "react";
import {Box, Text, useApp, useInput} from "ink";
import {applyTheme, buildThemes, installThemeAssets, readState} from "./manager";
import {THEME_ORDER, type ThemeId, THEMES, type Mode} from "./theme-registry";

const MODES: Mode[] = ["dark", "light"];
const ACTIONS = ["Apply theme", "Install assets", "Build outputs", "Quit"] as const;
type Focus = "theme" | "mode" | "action";

export function App() {
  const {exit} = useApp();
  const initialState = useMemo(() => readState(), []);
  const [current, setCurrent] = useState(initialState);
  const [themeIndex, setThemeIndex] = useState(THEME_ORDER.indexOf(initialState.theme));
  const [modeIndex, setModeIndex] = useState(MODES.indexOf(initialState.mode));
  const [actionIndex, setActionIndex] = useState(0);
  const [focus, setFocus] = useState<Focus>("action");
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<string[]>(["Ready. Enter applies to Ghostty, Tmux, Neovim, and Yazi."]);

  useInput((input, key) => {
    if (busy) {
      return;
    }

    if (input === "q" || key.escape) {
      exit();
      return;
    }

    if (key.tab) {
      setFocus((value) => (value === "theme" ? "mode" : value === "mode" ? "action" : "theme"));
      return;
    }

    if (key.leftArrow || input === "h") {
      if (focus === "theme") {
        setThemeIndex((value) => (value === 0 ? THEME_ORDER.length - 1 : value - 1));
      } else if (focus === "mode") {
        setModeIndex((value) => (value === 0 ? MODES.length - 1 : value - 1));
      } else {
        setActionIndex((value) => (value === 0 ? ACTIONS.length - 1 : value - 1));
      }
      return;
    }

    if (key.rightArrow || input === "l") {
      if (focus === "theme") {
        setThemeIndex((value) => (value + 1) % THEME_ORDER.length);
      } else if (focus === "mode") {
        setModeIndex((value) => (value + 1) % MODES.length);
      } else {
        setActionIndex((value) => (value + 1) % ACTIONS.length);
      }
      return;
    }

    if (key.upArrow || input === "k") {
      setFocus((value) => (value === "theme" ? "action" : value === "mode" ? "theme" : "mode"));
      return;
    }

    if (key.downArrow || input === "j") {
      setFocus((value) => (value === "theme" ? "mode" : value === "mode" ? "action" : "theme"));
      return;
    }

    if (key.return) {
      void runAction();
    }
  });

  const selectedTheme = THEME_ORDER[themeIndex] as ThemeId;
  const selectedMode = MODES[modeIndex] as Mode;

  async function runAction() {
    const action = ACTIONS[actionIndex];
    if (action === "Quit") {
      exit();
      return;
    }

    setBusy(true);
    try {
      const logger = (message: string) => setLines((currentLines) => [message, ...currentLines].slice(0, 6));
      if (action === "Apply theme") {
        const result = applyTheme(selectedTheme, selectedMode, undefined, {logger});
        if (result.state) {
          setCurrent(result.state);
        }
      } else if (action === "Install assets") {
        installThemeAssets("all", undefined, {logger});
      } else {
        buildThemes({logger});
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLines((currentLines) => [`Error: ${message}`, ...currentLines].slice(0, 6));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>theme-tape</Text>
      <Text color="gray">Merged theme manager for Ghostty, Tmux, Neovim, and Yazi.</Text>
      <Box marginTop={1} flexDirection="column">
        <Selector
          focused={focus === "theme"}
          label="Theme"
          value={THEMES[selectedTheme].label}
          hint="←/→ or h/l"
        />
        <Selector focused={focus === "mode"} label="Mode" value={selectedMode} hint="←/→ or h/l" />
        <Selector focused={focus === "action"} label="Action" value={ACTIONS[actionIndex]} hint="Enter" />
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color="cyan">Current</Text>
        <Text>{`${THEMES[current.theme].label} · ${current.mode}`}</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color="cyan">Shortcuts</Text>
        <Text>Tab cycle focus · j/k move section · q quit</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color={busy ? "yellow" : "green"}>{busy ? "Working..." : "Status"}</Text>
        {lines.map((line) => (
          <Text key={line}>{line}</Text>
        ))}
      </Box>
    </Box>
  );
}

function Selector(props: {focused: boolean; label: string; value: string; hint: string}) {
  return (
    <Text color={props.focused ? "green" : "white"}>
      {props.focused ? ">" : " "} {props.label}: {props.value} <Text color="gray">({props.hint})</Text>
    </Text>
  );
}
