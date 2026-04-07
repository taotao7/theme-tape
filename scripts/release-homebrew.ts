import {mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join, resolve} from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const repoRoot = appRoot;
const pkg = JSON.parse(readFileSync(join(appRoot, "package.json"), "utf8")) as {version: string};
const version = readFlag("--version") ?? pkg.version;
const repo = readFlag("--repo") ?? "taotao7/theme-tape";
const tapRepo = readFlag("--tap") ?? "taotao7/homebrew-tap";
const publish = process.argv.includes("--publish");
const tag = `theme-tape-v${version}`;
const archiveName = `theme-tape-${version}-darwin-arm64.tar.gz`;
const archivePath = join(appRoot, "dist", archiveName);

run("bun", ["run", "build"], appRoot);
run("tar", ["-czf", archivePath, "-C", join(appRoot, "dist"), "theme-tape"], appRoot);

const sha256 = capture("shasum", ["-a", "256", archivePath], appRoot).split(/\s+/)[0];

if (publish) {
  const releaseExists = spawnSync("gh", ["release", "view", tag, "--repo", repo], {stdio: "ignore"}).status === 0;
  if (releaseExists) {
    run("gh", ["release", "upload", tag, archivePath, "--clobber", "--repo", repo], repoRoot);
  } else {
    run(
      "gh",
      [
        "release",
        "create",
        tag,
        archivePath,
        "--title",
        `theme-tape ${version}`,
        "--notes",
        `theme-tape ${version}`,
        "--repo",
        repo,
      ],
      repoRoot,
    );
  }

  const tempRoot = mkdtempSync(join(tmpdir(), "theme-tape-tap-"));
  const tempDir = join(tempRoot, "homebrew-tap");
  try {
    run("gh", ["repo", "clone", tapRepo, tempDir, "--", "--depth", "1"], repoRoot);
    mkdirSync(join(tempDir, "Formula"), {recursive: true});
    writeFileSync(join(tempDir, "Formula", "theme-tape.rb"), renderFormula({repo, version, tag, sha256}), "utf8");
    run("git", ["-C", tempDir, "add", "Formula/theme-tape.rb"], repoRoot);
    run("git", ["-C", tempDir, "status", "--short", "--branch"], repoRoot);
    run("git", ["-C", tempDir, "diff", "--cached"], repoRoot);
    run("git", ["-C", tempDir, "commit", "-m", `feat: publish theme-tape ${version}`], repoRoot);
    run("git", ["-C", tempDir, "push", "origin", "main"], repoRoot);
  } finally {
    rmSync(tempRoot, {recursive: true, force: true});
  }
}

console.log(JSON.stringify({version, repo, tapRepo, tag, archivePath, sha256, publish}, null, 2));

function readFlag(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

function run(command: string, args: string[], cwd: string): void {
  const result = spawnSync(command, args, {cwd, stdio: "inherit"});
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
}

function capture(command: string, args: string[], cwd: string): string {
  const result = spawnSync(command, args, {cwd, encoding: "utf8"});
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
  return result.stdout.trim();
}

function renderFormula(input: {repo: string; version: string; tag: string; sha256: string}) {
  return `class ThemeTape < Formula
  desc "Terminal theme switcher for Cassette Futurism and Zenith"
  homepage "https://github.com/${input.repo}"
  url "https://github.com/${input.repo}/releases/download/${input.tag}/theme-tape-${input.version}-darwin-arm64.tar.gz"
  sha256 "${input.sha256}"
  license "MIT"

  depends_on :macos
  depends_on arch: :arm64

  def install
    bin.install "theme-tape"
  end

  test do
    assert_match "theme-tape", shell_output("#{bin}/theme-tape --help")
  end
end
`;
}
