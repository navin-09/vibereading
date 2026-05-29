# 🎧 VibeRead — Your Funky Tech Tutor

**Turns any tech book into an addictive, interactive quest.** No summaries. Just analogies, force recall, and streaks that make you want to come back.

## What Makes VibeRead Different

- **Analogy-first teaching** — Every concept starts with a real-world hook. Jargon comes second.
- **Force recall** — You must explain every chunk back in your own words before advancing. Non-negotiable.
- **No summaries** — The agent teaches through dialogue. Never dumps a wall of text.
- **One mode: Tutor Mode** — The agent reads the book and teaches you. You don't read independently.
- **Daily streak** — Keeps you coming back. No XP, no combos, no boss fights. Just good teaching.
- **Git repos + PDFs** — Your book source is either a git repo (markdown docs) or a PDF file.

## Quick Start

### Install

```bash
pi install git:github.com/navin-09/vibereading
pi config   # Enable "vibereading" extension + skill
```

### Add a Book

```bash
pi
/viberead add
```

Follow the prompts to provide your book source (git repo URL or PDF path).

### Start Reading

```bash
/viberead
```

The agent loads your book and starts teaching from where you left off. You'll see your current streak and chapter progress.

### Commands

| Command | Action |
|---------|--------|
| `/viberead` | Toggle VibeRead (start/pause session) |
| `/viberead add` | Add a new book |
| `/viberead switch <book>` | Switch to a different book |
| `/viberead books` | List all books with progress |

## Architecture

```
vibereading/
├── skills/
│   └── SKILL.md              # Teaching methodology (analogy-first, force recall)
├── extensions/
│   └── vibereading.ts        # Enforcer (~90 lines): auto-save + rules injection + streak
├── scripts/
│   └── init-book.js          # One-time: set up a book from git repo or PDF
├── package.json
└── README.md
```

## Progress Storage

- `~/.pi/vibereading/registry.json` — global registry (books, streak)
- `~/.pi/vibereading/<slug>.json` — per-book progress (current chapter, completed chapters)
- `~/.pi/vibereading/sources/<slug>/` — cloned git repos (if source is a git URL)

## License

MIT
