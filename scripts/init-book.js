/**
 * VibeRead — Initialize a book
 *
 * Usage:
 *   node scripts/init-book.js --source <git-repo-url|file-path> --title "My Title" --chapters 12
 *
 * Creates:
 *   ~/.pi/vibereading/<slug>.json  — progress file
 *   ~/.pi/vibereading/registry.json — updates registry with the new book
 *
 * For git repos: clones into ~/.pi/vibereading/sources/<slug>/
 * For local files: symlinks the path
 */

const { existsSync, readFileSync, writeFileSync, mkdirSync, symlinkSync } = require("fs");
const { homedir } = require("os");
const { join, basename, extname } = require("path");
const { execSync } = require("child_process");

const VIBEREAD_DIR = join(homedir(), ".pi", "vibereading");
const REGISTRY_PATH = join(VIBEREAD_DIR, "registry.json");

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function loadRegistry() {
  if (!existsSync(REGISTRY_PATH)) {
    return { books: [], streak: { current: 0, longest: 0, lastSessionDate: "" } };
  }
  try { return JSON.parse(readFileSync(REGISTRY_PATH, "utf-8")); }
  catch { return { books: [], streak: { current: 0, longest: 0, lastSessionDate: "" } }; }
}

function saveRegistry(reg) {
  if (!existsSync(VIBEREAD_DIR)) mkdirSync(VIBEREAD_DIR, { recursive: true });
  writeFileSync(REGISTRY_PATH, JSON.stringify(reg, null, 2));
}

// ── Parse args ──

const args = process.argv.slice(2);
let source = "";
let title = "";
let totalChapters = 1;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--source" && args[i + 1]) source = args[++i];
  if (args[i] === "--title" && args[i + 1]) title = args[++i];
  if (args[i] === "--chapters" && args[i + 1]) totalChapters = parseInt(args[++i], 10);
}

if (!source || !title) {
  console.error("Usage: node scripts/init-book.js --source <url|path> --title \"Title\" --chapters N");
  process.exit(1);
}

const slug = slugify(title);
console.log(`📖 Initializing "${title}" (${slug})`);

// ── Handle source ──

let isGit = false;
if (source.startsWith("http") || source.startsWith("git@")) {
  isGit = true;
  const sourcesDir = join(VIBEREAD_DIR, "sources");
  const repoDir = join(sourcesDir, slug);

  if (existsSync(repoDir)) {
    console.log(`  Repo already cloned at ${repoDir}`);
  } else {
    console.log(`  Cloning ${source}...`);
    if (!existsSync(sourcesDir)) mkdirSync(sourcesDir, { recursive: true });
    execSync(`git clone --depth 1 "${source}" "${repoDir}"`, { stdio: "inherit" });
    console.log(`  Cloned to ${repoDir}`);
  }
  source = source; // keep the URL as the source reference
} else {
  // Local file
  if (!existsSync(source)) {
    console.error(`  Error: File not found: ${source}`);
    process.exit(1);
  }
  console.log(`  Source: ${source}`);
}

// ── Create progress file ──

const progress = {
  book: {
    title,
    source,
    slug,
    totalChapters,
    dateStarted: todayStr(),
  },
  progress: {
    currentChapter: 1,
    completedChapters: [],
  },
};

const progressPath = join(VIBEREAD_DIR, `${slug}.json`);
if (existsSync(progressPath)) {
  console.log(`  Progress file already exists (resuming).`);
} else {
  if (!existsSync(VIBEREAD_DIR)) mkdirSync(VIBEREAD_DIR, { recursive: true });
  writeFileSync(progressPath, JSON.stringify(progress, null, 2));
  console.log(`  Created ${progressPath}`);
}

// ── Update registry ──

const reg = loadRegistry();
const existing = reg.books.find((b) => b.slug === slug);
if (existing) {
  existing.lastActiveAt = new Date().toISOString();
} else {
  reg.books.push({
    slug,
    title,
    source,
    addedAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  });
}
saveRegistry(reg);

console.log(`  Registry updated: ${reg.books.length} book(s) tracked`);
console.log(`\n✅ Done! Type /viberead switch ${slug} to start reading.`);
