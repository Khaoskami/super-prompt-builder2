# Super Prompt Builder

A precision-engineered prompt construction tool for AI roleplay character creation. Build structured, high-quality character prompts with real-time token counting, template scaffolding, and export to Markdown or Tavern-compatible JSON.

![Super Prompt Builder](https://img.shields.io/badge/version-1.0.0-blue) ![License](https://img.shields.io/badge/license-MIT-green)

## Features

- **Section-based editing** — Identity, Personality, Scenario, Dialogue, Lorebook, System
- **Starter templates** — Otome Intrigue, Combat RPG, Slice of Life, Demon Hunter
- **Real-time token estimation** — Per-field and global counts
- **Dual export formats** — Markdown and Tavern-spec JSON
- **One-click copy** — Compiled output straight to clipboard
- **Lorebook entries** — Keyword-triggered context injection
- **Zero dependencies** — Pure React, inline styles, no build toolchain required

## Quick Start

### Run in Claude.ai
Drop `super-prompt.jsx` into a Claude artifact — it renders immediately.

### Run standalone (Vite)

```bash
git clone https://github.com/Khaoskami/super-prompt-builder.git
cd super-prompt-builder
npm install
npm run dev
```

### Run standalone (plain HTML)

Open `public/index.html` in any browser. No server required.

## Project Structure

```
super-prompt-builder/
├── src/
│   └── SuperPromptBuilder.jsx   # Main component (self-contained)
├── public/
│   └── index.html               # Standalone HTML version
├── package.json
├── vite.config.js
├── LICENSE
└── README.md
```

## Export Formats

### Markdown
Structured prompt output with headers, bold field labels, and clean formatting. Paste directly into any AI chat interface.

### JSON (Tavern)
SillyTavern / TavernAI-compatible character card spec with:
- `name`, `description`, `personality`, `scenario`
- `first_mes`, `mes_example`, `system_prompt`
- `post_history_instructions`, `creator_notes`
- `extensions.world` (lorebook entries with keyword triggers)

## Design System

Intentional dark palette — not vibe-coded:

| Token | Hex | Usage |
|-------|-----|-------|
| Base | `#0B0E14` | Page background |
| Surface 1 | `#111620` | Card backgrounds |
| Surface 2 | `#1A2030` | Elevated elements |
| Accent | `#3B82F6` | Actions, focus rings |
| Text Primary | `#E8ECF2` | Main content (WCAG AAA) |

Full color system documented in source comments.

## License

MIT — do whatever you want with it.

## Author

Built by [Khaos](https://github.com/Khaoskami) as part of the Vixai ecosystem.
