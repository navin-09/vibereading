/**
 * VibeRead Enforcer Extension
 *
 * Minimal enforcer — does exactly 2 things:
 * 1. Auto-saves progress on every turn (LLM won't forget)
 * 2. Injects core rules + streak state into system prompt every turn (so LLM doesn't drift)
 *
 * That's it. ~90 lines. No gamification engine, no RNG, no level calc.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join, dirname } from "path";

// ── Paths ──
const PROGRESS_DIR = join(homedir(), ".pi", "vibereading");
const REGISTRY_PATH = join(PROGRESS_DIR, "registry.json");

function bookProgressPath(slug: string): string {
  return join(PROGRESS_DIR, `${slug}.json`);
}

// ── Data helpers ──

function loadRegistry(): any {
  if (!existsSync(REGISTRY_PATH)) return null;
  try { return JSON.parse(readFileSync(REGISTRY_PATH, "utf-8")); }
  catch { return null; }
}

function saveRegistry(reg: any): void {
  if (!existsSync(PROGRESS_DIR)) mkdirSync(PROGRESS_DIR, { recursive: true });
  writeFileSync(REGISTRY_PATH, JSON.stringify(reg, null, 2));
}

function loadProgress(slug: string): any {
  const p = bookProgressPath(slug);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, "utf-8")); }
  catch { return null; }
}

function saveProgress(slug: string, data: any): void {
  if (!existsSync(PROGRESS_DIR)) mkdirSync(PROGRESS_DIR, { recursive: true });
  writeFileSync(bookProgressPath(slug), JSON.stringify(data, null, 2));
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

// ── Active book helpers ──

function getActiveBooks(): any[] {
  const reg = loadRegistry();
  return reg?.books || [];
}

// ── Core rules injected every turn ──

const CORE_RULES = `
## VibeRead Rules (enforced by extension — LLM must follow)

### Teaching Rules
- **Tutor mode only.** You read the book source and teach chunk-by-chunk.
- **Analogy-first.** Every new concept starts with a fun, relatable real-world analogy. No jargon first.
- **One chunk at a time.** Teach one chunk → force recall check → only then move to next chunk.
- **Force recall.** After teaching a chunk, the user must explain it back in their own words before you advance. Non-negotiable.
- **NEVER summarize.** No chapter summaries, no "here's what we covered," no bullet-point TL;DR. You teach through dialogue.
- **If stuck, try a fresh analogy.** Never push through confusion. Pick a different real-world comparison.
- **Cover the topic fully.** Every concept in the chapter gets taught in depth. No skipping.

### Anti-Patterns (NEVER do these)
- ❌ Dumping a summary "just this once"
- ❌ Teaching two chunks without a recall check between them
- ❌ Using jargon before the analogy
- ❌ Listing all concepts in a chapter upfront (that's a summary in disguise)
`.trim();

// ── Extension ──

export default function (pi: ExtensionAPI) {
  let activeBookSlug: string | null = null;
  let activeBookTitle: string | null = null;

  // ── /viberead command ──

  pi.registerCommand("viberead", {
    description: "Start/pause VibeRead session, manage books",
    usage: "[/viberead | /viberead add | /viberead switch <book> | /viberead books]",
    handler: async (args, ctx) => {
      const trimmed = (args || "").trim().toLowerCase();

      if (trimmed === "add") {
        activeBookSlug = null;
        activeBookTitle = null;
        await pi.sendUserMessage(
          "/viberead add — User wants to add a new book. Run init: ask for book source (git repo URL or PDF path), detect title and chapter count, create progress file, display skill tree."
        );
        return;
      }

      if (trimmed.startsWith("switch ")) {
        const target = trimmed.slice(7).trim();
        const books = getActiveBooks();
        const found = books.find(
          (b: any) => b.slug === target
        );
        if (!found) {
          await pi.sendUserMessage(
            `/viberead — Book "${target}" not found. Books: ${books.map((b: any) => b.title).join(", ")}`
          );
          return;
        }
        activeBookSlug = found.slug;
        activeBookTitle = found.title;
        await pi.sendUserMessage(
          `/viberead switched to "${found.title}" — Load progress, show streak, start teaching from current chapter.`
        );
        return;
      }

      if (trimmed === "books") {
        const books = getActiveBooks();
        if (books.length === 0) {
          await pi.sendUserMessage("/viberead books — No books yet. Use /viberead add to start.");
          return;
        }
        const lines = books.map((b: any) => {
          const p = loadProgress(b.slug);
          const ch = p?.progress?.currentChapter || 1;
          const total = p?.book?.totalChapters || "?";
          return `  ${b.title} — Ch.${ch}/${total}`;
        });
        await pi.sendUserMessage(`VibeRead Books:\n${lines.join("\n")}`);
        return;
      }

      // Toggle
      if (activeBookSlug) {
        activeBookSlug = null;
        activeBookTitle = null;
        await pi.sendUserMessage(
          "/viberead deactivated — Show session summary (chapters covered, streak status), update registry lastActiveAt."
        );
      } else {
        const books = getActiveBooks();
        if (books.length === 0) {
          await pi.sendUserMessage(
            "/viberead activated — No books yet. Run init: ask for book source (git repo URL or PDF path)."
          );
        } else if (books.length === 1) {
          activeBookSlug = books[0].slug;
          activeBookTitle = books[0].title;
          await pi.sendUserMessage(
            `/viberead activated — Continuing "${books[0].title}". Show streak, load progress, start teaching.`
          );
        } else {
          const summary = books.map((b: any, i: number) => {
            const p = loadProgress(b.slug);
            const ch = p?.progress?.currentChapter || 1;
            return `${i + 1}. ${b.title} — Ch.${ch}`;
          }).join("\n");
          await pi.sendUserMessage(
            `VibeRead\n${summary}\nWhich book? Say the name.`
          );
        }
      }
    },
  });

  // ── Inject rules + streak every turn ──

  pi.on("before_agent_start", async (event, ctx) => {
    if (!activeBookSlug) return;

    let updated = event.systemPrompt;
    updated += `\n\n## VibeRead Rules (active)\n${CORE_RULES}\n`;

    // Streak state
    const reg = loadRegistry();
    const streak = reg?.streak?.current || 0;
    if (streak > 0) {
      updated += `\n🔥 Current streak: ${streak} day${streak > 1 ? "s" : ""}\n`;
    } else {
      updated += "\n🔥 No streak yet. First session counts!\n";
    }

    // Current progress
    const progress = loadProgress(activeBookSlug);
    if (progress) {
      const ch = progress.progress?.currentChapter || 1;
      const total = progress.book?.totalChapters || 1;
      updated += `\n📖 ${activeBookTitle} — Ch.${ch}/${total}\n`;
    }

    return { systemPrompt: updated };
  });

  // ── Auto-save on every turn + update streak ──

  pi.on("agent_end", async (_event, ctx) => {
    if (!activeBookSlug) return;

    // Update streak in registry
    const reg = loadRegistry() || { books: [], streak: { current: 0, longest: 0, lastSessionDate: "" } };
    const today = todayStr();
    if (reg.streak.lastSessionDate === today) {
      // Already counted today — no change
    } else if (reg.streak.lastSessionDate) {
      const last = new Date(reg.streak.lastSessionDate);
      const gap = Math.floor((new Date(today).getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
      if (gap === 1) {
        reg.streak.current += 1;
        if (reg.streak.current > reg.streak.longest) reg.streak.longest = reg.streak.current;
      } else if (gap > 1) {
        reg.streak.current = 1; // reset
      }
    } else {
      reg.streak.current = 1;
      if (reg.streak.current > reg.streak.longest) reg.streak.longest = reg.streak.current;
    }
    reg.streak.lastSessionDate = today;

    // Update lastActiveAt for this book
    const bookEntry = reg.books?.find((b: any) => b.slug === activeBookSlug);
    if (bookEntry) bookEntry.lastActiveAt = new Date().toISOString();

    saveRegistry(reg);
  });

  // ── Notify on startup ──

  pi.on("session_start", async (_event, ctx) => {
    const books = getActiveBooks();
    const reg = loadRegistry();
    const streak = reg?.streak?.current || 0;
    if (!ctx.hasUI) return;
    const bookCount = books.length;
    ctx.ui.notify(
      `🎧 VibeRead loaded (${bookCount} book${bookCount !== 1 ? "s" : ""}${streak > 0 ? `, 🔥 ${streak}d streak` : ""}).\n` +
      `   Type /viberead to start a session.`,
      "info"
    );
  });
}
