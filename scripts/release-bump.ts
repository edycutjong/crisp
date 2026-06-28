/**
 * Automated Semantic Version Bump & GitHub Release
 *
 * Reads conventional commits since the last tag and determines the bump type:
 *   - BREAKING CHANGE / feat!: → major
 *   - feat:                    → minor
 *   - fix: / perf: / refactor: → patch
 *   - chore: / docs: / ci:    → skip (no release)
 *
 * Generates a categorized CHANGELOG, updates package.json + Cargo.toml files,
 * commits with [skip ci], tags, pushes, and creates a GitHub Release with notes.
 *
 * Usage: npx tsx scripts/release-bump.ts
 * Env:   GITHUB_TOKEN (required in CI for GitHub Release creation)
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

// ── Helpers ───────────────────────────────────────────────────────────────────

function run(cmd: string, silent = false): string {
  try {
    return execSync(cmd, {
      encoding: "utf-8",
      stdio: silent ? "pipe" : "inherit",
    }).trim();
  } catch (err) {
    if (!silent) console.error(`Command failed: ${cmd}`);
    throw err;
  }
}

function runSafe(cmd: string): string {
  try {
    return execSync(cmd, { encoding: "utf-8", stdio: "pipe" }).trim();
  } catch {
    return "";
  }
}

// ── Conventional Commit Parser ────────────────────────────────────────────────

interface ParsedCommit {
  hash: string;
  type: string;
  scope: string | null;
  breaking: boolean;
  subject: string;
  raw: string;
}

const COMMIT_RE = /^([a-z]+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/i;

function parseCommit(line: string): ParsedCommit | null {
  const spaceIdx = line.indexOf(" ");
  if (spaceIdx === -1) return null;
  const hash = line.substring(0, spaceIdx);
  const message = line.substring(spaceIdx + 1);

  const match = message.match(COMMIT_RE);
  if (!match) return null;

  return {
    hash,
    type: match[1].toLowerCase(),
    scope: match[2] || null,
    breaking: match[3] === "!" || message.includes("BREAKING CHANGE:"),
    subject: match[4],
    raw: message,
  };
}

// ── Version Calculation ───────────────────────────────────────────────────────

type BumpType = "major" | "minor" | "patch" | "none";

const PATCH_TYPES = new Set(["fix", "perf", "refactor", "revert", "build"]);
const MINOR_TYPES = new Set(["feat"]);

function determineBump(commits: ParsedCommit[]): BumpType {
  let bump: BumpType = "none";
  for (const c of commits) {
    if (c.breaking) return "major";
    if (MINOR_TYPES.has(c.type) && bump !== "minor") bump = "minor";
    if (PATCH_TYPES.has(c.type) && bump === "none") bump = "patch";
  }
  return bump;
}

function incrementVersion(version: string, bump: BumpType): string {
  const [major, minor, patch] = version.split(".").map(Number);
  switch (bump) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    default:
      return version;
  }
}

// ── Changelog Generation ──────────────────────────────────────────────────────

function generateChangelog(
  commits: ParsedCommit[],
  newVersion: string,
  prevTag: string,
): string {
  const date = new Date().toISOString().split("T")[0];
  const sections: Record<string, ParsedCommit[]> = {};

  const SECTION_MAP: Record<string, string> = {
    feat: "🚀 Features",
    fix: "🐛 Bug Fixes",
    perf: "⚡ Performance",
    refactor: "♻️ Refactoring",
    revert: "⏪ Reverts",
    build: "🏗️ Build",
    docs: "📝 Documentation",
    ci: "🤖 CI/CD",
    chore: "🔧 Chores",
    style: "💄 Style",
    test: "✅ Tests",
  };

  for (const c of commits) {
    const section = SECTION_MAP[c.type] || "🔖 Other";
    if (!sections[section]) sections[section] = [];
    sections[section].push(c);
  }

  const breaking = commits.filter((c) => c.breaking);

  let md = `## [${newVersion}](../../compare/${prevTag}...v${newVersion}) (${date})\n\n`;

  if (breaking.length > 0) {
    md += "### ⚠️ BREAKING CHANGES\n\n";
    for (const c of breaking) {
      const scope = c.scope ? `**${c.scope}:** ` : "";
      md += `- ${scope}${c.subject} (${c.hash})\n`;
    }
    md += "\n";
  }

  const ORDER = [
    "🚀 Features",
    "🐛 Bug Fixes",
    "⚡ Performance",
    "♻️ Refactoring",
  ];
  const orderedKeys = [
    ...ORDER.filter((k) => sections[k]),
    ...Object.keys(sections).filter((k) => !ORDER.includes(k)),
  ];

  for (const section of orderedKeys) {
    const items = sections[section];
    md += `### ${section}\n\n`;
    for (const c of items) {
      const scope = c.scope ? `**${c.scope}:** ` : "";
      md += `- ${scope}${c.subject} (${c.hash})\n`;
    }
    md += "\n";
  }

  return md;
}

// ── File Updates ──────────────────────────────────────────────────────────────

function findCargoTomls(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (
      file === "node_modules" ||
      file === ".next" ||
      file === "target" ||
      file === ".git"
    )
      continue;
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      findCargoTomls(filePath, fileList);
    } else if (file === "Cargo.toml") {
      fileList.push(filePath);
    }
  }
  return fileList;
}

function updateCargoToml(cargoPath: string, newVersion: string): boolean {
  let content = fs.readFileSync(cargoPath, "utf-8");
  if (content.includes("[package]")) {
    content = content.replace(
      /^version = "[^"]+"/m,
      `version = "${newVersion}"`,
    );
    fs.writeFileSync(cargoPath, content, "utf-8");
    console.log(
      `  ✓ Cargo.toml at ${path.relative(process.cwd(), cargoPath)} → ${newVersion}`,
    );
    return true;
  }
  return false;
}

// ── GitHub Release ────────────────────────────────────────────────────────────

async function createGitHubRelease(tag: string, body: string): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.log("  ⚠ GITHUB_TOKEN not set, skipping GitHub Release creation");
    return;
  }

  const repo = runSafe("git remote get-url origin")
    .replace(/\.git$/, "")
    .replace(/^.*github\.com[:/]/, "");

  if (!repo) {
    console.log("  ⚠ Could not determine GitHub repo, skipping Release");
    return;
  }

  const res = await fetch(`https://api.github.com/repos/${repo}/releases`, {
    method: "POST",
    headers: {
      Authorization: `token ${token}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.github.v3+json",
    },
    body: JSON.stringify({
      tag_name: tag,
      name: tag,
      body,
      draft: false,
      prerelease: false,
    }),
  });

  if (res.ok) {
    const data = (await res.json()) as { html_url?: string };
    console.log(`  ✓ GitHub Release created: ${data.html_url}`);
  } else {
    const err = await res.text();
    console.log(
      `  ⚠ GitHub Release failed (${res.status}): ${err.substring(0, 200)}`,
    );
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const pkgPath = path.join(process.cwd(), "package.json");
  if (!fs.existsSync(pkgPath)) {
    console.error("package.json not found");
    process.exit(1);
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  const currentVersion = pkg.version;

  const lastTag = runSafe("git describe --tags --abbrev=0");
  console.log(`\n📦 Semantic Release`);
  console.log(`  Current : ${currentVersion}`);
  console.log(`  Last tag: ${lastTag || "(none)"}`);

  const logCmd = lastTag
    ? `git log ${lastTag}..HEAD --oneline --no-merges`
    : "git log --oneline --no-merges -n 50";
  const logOutput = runSafe(logCmd);
  const lines = logOutput ? logOutput.split("\n") : [];

  const parsed = lines
    .map(parseCommit)
    .filter((c): c is ParsedCommit => c !== null);
  const nonConventional = lines.length - parsed.length;

  console.log(
    `  Commits : ${lines.length} total, ${parsed.length} conventional, ${nonConventional} skipped`,
  );

  if (parsed.length === 0) {
    console.log(`\n✅ No releasable conventional commits. Skipping.`);
    return;
  }

  const bump = determineBump(parsed);
  if (bump === "none") {
    console.log(`\n✅ Only non-releasable commits. Skipping.`);
    return;
  }

  const newVersion = incrementVersion(currentVersion, bump);
  const prevTag = lastTag || "HEAD~50";
  console.log(`  Bump    : ${bump} → ${newVersion}\n`);

  const changelog = generateChangelog(parsed, newVersion, prevTag);

  console.log("📝 Updating files:");
  pkg.version = newVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
  console.log(`  ✓ package.json → ${newVersion}`);

  const cargoPaths = findCargoTomls(process.cwd());
  let hasContracts = false;
  for (const cp of cargoPaths) {
    if (updateCargoToml(cp, newVersion)) {
      hasContracts = true;
    }
  }

  // Prepend to CHANGELOG.md
  const changelogPath = path.join(process.cwd(), "CHANGELOG.md");
  const HEADER =
    "# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n";
  let existing = "";
  if (fs.existsSync(changelogPath)) {
    existing = fs
      .readFileSync(changelogPath, "utf-8")
      .replace(/^# Changelog\n+.*documented in this file\.\n*/i, "");
  }
  fs.writeFileSync(changelogPath, HEADER + changelog + existing, "utf-8");
  console.log(`  ✓ CHANGELOG.md updated`);

  if (process.env.GITHUB_ACTIONS === "true") {
    console.log("\n🚀 Publishing:");
    run('git config --global user.name "github-actions[bot]"', true);
    run(
      'git config --global user.email "github-actions[bot]@users.noreply.github.com"',
      true,
    );

    run("git add package.json CHANGELOG.md", true);
    for (const cp of cargoPaths) {
      run(`git add "${path.relative(process.cwd(), cp)}"`, true);
      const lockPath = cp.replace(/\.toml$/, ".lock");
      if (fs.existsSync(lockPath)) {
        run(`git add "${path.relative(process.cwd(), lockPath)}"`, true);
      }
    }

    run(`git commit -m "chore(release): v${newVersion} [skip ci]"`, true);
    run(`git tag -a v${newVersion} -m "Release v${newVersion}"`, true);
    run("git push origin main --follow-tags", true);
    console.log(`  ✓ Committed, tagged v${newVersion}, pushed`);

    await createGitHubRelease(`v${newVersion}`, changelog);
  } else {
    console.log(
      `\n⚠ Not in CI — skipping commit/tag/push. Run locally to preview.`,
    );
    console.log(`\nChangelog preview:\n${changelog}`);
  }

  console.log(`\n✅ Release v${newVersion} complete.`);
}

main().catch((e) => {
  console.error(`\n✗ Release failed: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
