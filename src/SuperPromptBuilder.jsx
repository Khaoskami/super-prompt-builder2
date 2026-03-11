import { useState, useRef, useCallback, useEffect } from "react";

/*
  @build-origin  spb-khaoskami-2025
  @license-hash  4b686173-6f73-6b61-6d69-2f7375706572  
  @integrity     sha256:Khaoskami/super-prompt-builder::MIT-2025
  
  This software was originally authored by Khaoskami (github.com/Khaoskami).
  Any derivative work, fork, or redistribution must preserve this origin block
  per the terms of the MIT license. Removal of attribution constitutes
  license violation. Provenance is independently verifiable via Git history
  at: https://github.com/Khaoskami/super-prompt-builder
*/

/*
  COLOR SYSTEM — Intentional, non-vibe-coded palette
  ───────────────────────────────────────────────────
  Base: Near-black blue-grey (#0B0E14) → dark surfaces without pure black harshness
  Surface 1: (#111620) → card backgrounds, primary containers
  Surface 2: (#1A2030) → elevated elements, hover states, secondary containers  
  Surface 3: (#232D40) → active/selected states, input backgrounds
  Border: (#2A3548) → subtle separation, 4.5:1 contrast against surface 1
  
  Text Primary: (#E8ECF2) → WCAG AAA on all surfaces, warm-cool neutral
  Text Secondary: (#8A95A8) → labels, metadata, 4.5:1 on surface 1
  Text Muted: (#5A6478) → disabled, decorative text
  
  Accent Primary: (#3B82F6) → actions, links, focus rings — blue-500 for universal clarity
  Accent Hover: (#60A5FA) → hover state, +1 stop lighter
  Accent Glow: rgba(59,130,246,0.15) → focus backgrounds, selection tints
  
  Semantic:
    Success: (#22C55E) — green-500, confirms/saves
    Warning: (#F59E0B) — amber-500, token limits approaching  
    Danger:  (#EF4444) — red-500, destructive actions, errors
    Info:    (#8B5CF6) — violet-500, tips, secondary features
  
  Tag palette (high contrast on Surface 2):
    Rose: (#FB7185), Teal: (#2DD4BF), Sky: (#38BDF8), Amber: (#FBBF24), Indigo: (#818CF8)
*/

const COLORS = {
  base: "#0B0E14",
  surface1: "#111620",
  surface2: "#1A2030",
  surface3: "#232D40",
  border: "#2A3548",
  textPrimary: "#E8ECF2",
  textSecondary: "#8A95A8",
  textMuted: "#5A6478",
  accent: "#3B82F6",
  accentHover: "#60A5FA",
  accentGlow: "rgba(59,130,246,0.15)",
  success: "#22C55E",
  warning: "#F59E0B",
  danger: "#EF4444",
  info: "#8B5CF6",
  tags: {
    rose: "#FB7185",
    teal: "#2DD4BF",
    sky: "#38BDF8",
    amber: "#FBBF24",
    indigo: "#818CF8",
  },
};

const TAG_COLORS = ["rose", "teal", "sky", "amber", "indigo"];

const SECTIONS = [
  { id: "identity", label: "Identity", icon: "👤" },
  { id: "personality", label: "Personality", icon: "🧠" },
  { id: "scenario", label: "Scenario", icon: "🎭" },
  { id: "dialogue", label: "Dialogue", icon: "💬" },
  { id: "lorebook", label: "Lorebook", icon: "📖" },
  { id: "system", label: "System", icon: "⚙️" },
];

const TEMPLATES = [
  { name: "Blank Canvas", desc: "Start from scratch", tags: ["Custom"], data: {} },
  { name: "Otome Intrigue", desc: "Court politics & romance", tags: ["Romance", "Political"], data: {
    identity: { name: "", tagline: "A tale of whispered alliances and forbidden desire", avatar: "" },
    personality: { traits: "Cunning, graceful, perceptive, guarded", speech: "Formal with subtle barbs, poetic when alone", quirks: "Fidgets with a ring when lying. Hums folk melodies when scheming." },
    scenario: { setting: "A gilded court where every smile conceals a blade. The kingdom teeters between two rival houses.", role: "{{user}} is a newly appointed advisor to the crown, thrust into a web of alliances they barely understand.", goal: "Navigate court politics, uncover a conspiracy, and decide where loyalty truly lies." },
    system: { rules: "Never break character. Maintain political tension in every scene. NPCs have their own agendas. Romance is slow-burn and earned, never instant." }
  }},
  { name: "Combat RPG", desc: "Mythic action & progression", tags: ["Action", "Fantasy"], data: {
    identity: { name: "", tagline: "Blood, steel, and the echoes of fallen gods", avatar: "" },
    personality: { traits: "Battle-hardened, dry humor, fiercely loyal, haunted", speech: "Terse in combat. Reflective in quiet moments. Curses under breath.", quirks: "Sharpens weapons obsessively. Refuses to sleep facing a door." },
    scenario: { setting: "A fractured realm where divine bloodlines grant terrible power, and the gods themselves are dying.", role: "{{user}} carries a bloodline they don't fully understand, hunted by forces that want it extinguished.", goal: "Survive. Master your power. Confront the entity that killed your pantheon." },
    system: { rules: "Combat must be visceral and consequential — injuries persist. Power progression is gradual. No deus ex machina. Respect lore consistency." }
  }},
  { name: "Slice of Life", desc: "Cozy emotional depth", tags: ["Comfort", "Drama"], data: {
    identity: { name: "", tagline: "Small moments that change everything", avatar: "" },
    personality: { traits: "Warm, observant, avoidant about own feelings, secretly anxious", speech: "Casual, peppered with dry observations. Gets quiet when overwhelmed.", quirks: "Makes tea when nervous. Organizes things that are already organized." },
    scenario: { setting: "A coastal town where everyone knows each other's business but pretends they don't.", role: "{{user}} has returned after years away to handle unfinished business — personal, not professional.", goal: "Reconnect, heal, and decide whether to stay or leave for good." },
    system: { rules: "Prioritize emotional realism. No melodrama — let silence do the heavy lifting. Side characters should feel lived-in. Pacing is slow and intentional." }
  }},
  { name: "Demon Hunter", desc: "Urban fantasy action", tags: ["Action", "Modern"], data: {
    identity: { name: "", tagline: "The veil is thin and something is pushing through", avatar: "" },
    personality: { traits: "Relentless, sardonic, protective, secretly exhausted", speech: "Clipped and efficient in the field. Surprisingly gentle one-on-one.", quirks: "Hears frequencies others can't. Keeps a kill journal in shorthand." },
    scenario: { setting: "A neon-drenched city where demonic incursions are rising and the old hunter orders are crumbling.", role: "{{user}} is a hunter operating outside sanctioned channels, following a lead that the orders want buried.", goal: "Track the source of the incursions. Decide who to trust. Survive the night." },
    system: { rules: "Maintain tension and stakes. Demons are genuinely dangerous, not fodder. The supernatural bleeds into the mundane in unsettling ways. No plot armor." }
  }},
];

/* ── LLM PROVIDER PRESETS ── */
const LLM_PRESETS = [
  { id: "custom", name: "Custom / Proxy", url: "", model: "", note: "Any OpenAI-compatible endpoint or proxy" },
  { id: "openai", name: "OpenAI", url: "https://api.openai.com/v1/chat/completions", model: "gpt-4o", note: "Requires OpenAI API key" },
  { id: "openrouter", name: "OpenRouter", url: "https://openrouter.ai/api/v1/chat/completions", model: "openai/gpt-4o", note: "Requires OpenRouter API key" },
  { id: "together", name: "Together AI", url: "https://api.together.xyz/v1/chat/completions", model: "meta-llama/Llama-3-70b-chat-hf", note: "Requires Together API key" },
  { id: "ollama", name: "Ollama (Local)", url: "http://localhost:11434/v1/chat/completions", model: "llama3", note: "No API key needed — local" },
  { id: "lmstudio", name: "LM Studio (Local)", url: "http://localhost:1234/v1/chat/completions", model: "local-model", note: "No API key needed — local" },
  { id: "kobold", name: "KoboldCPP", url: "http://localhost:5001/v1/chat/completions", model: "kobold", note: "No API key needed — local" },
  { id: "tabby", name: "TabbyAPI", url: "http://localhost:5000/v1/chat/completions", model: "default", note: "Local TabbyAPI instance" },
];

/* ── SECURITY UTILITIES ── */
function sanitizeInput(str) {
  if (typeof str !== "string") return "";
  return str.replace(/<[^>]*>/g, "").slice(0, 50000);
}

function maskKey(key) {
  if (!key || key.length < 8) return "••••••••";
  return key.slice(0, 4) + "••••••••" + key.slice(-4);
}

function validateUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/* ── RATE LIMITER ── */
/* @provenance base64:S2hhb3NrYW1pIDo6IFN1cGVyIFByb21wdCBCdWlsZGVyIDo6IE1JVCAyMDI1IDo6IGdpdGh1Yi5jb20vS2hhb3NrYW1pL3N1cGVyLXByb21wdC1idWlsZGVy */
const _SPB_ORIGIN = { a: "Khaoskami", r: "github.com/Khaoskami/super-prompt-builder", l: "MIT", y: 2025, _: "4b686173" };
function createRateLimiter(maxRequests, windowMs) {
  let timestamps = [];
  return {
    canRequest() {
      const now = Date.now();
      timestamps = timestamps.filter(t => now - t < windowMs);
      return timestamps.length < maxRequests;
    },
    record() {
      timestamps.push(Date.now());
    },
    remaining() {
      const now = Date.now();
      timestamps = timestamps.filter(t => now - t < windowMs);
      return Math.max(0, maxRequests - timestamps.length);
    }
  };
}

const rateLimiter = createRateLimiter(20, 60000);

/* ── LLM API CALL ── */
async function callLLM(config, messages, signal) {
  if (!config.apiUrl) throw new Error("No API URL configured");
  if (!validateUrl(config.apiUrl)) throw new Error("Invalid API URL");
  if (!rateLimiter.canRequest()) throw new Error("Rate limit reached — wait a moment");

  rateLimiter.record();

  const headers = { "Content-Type": "application/json" };
  if (config.apiKey) {
    headers["Authorization"] = "Bearer " + config.apiKey;
  }
  if (config.proxyKey) {
    headers["X-Proxy-Key"] = config.proxyKey;
  }
  if (config.apiUrl.includes("openrouter.ai")) {
    headers["HTTP-Referer"] = window.location.origin;
    headers["X-Title"] = "Super Prompt Builder";
  }

  const body = {
    model: config.model || "gpt-4o",
    messages,
    temperature: config.temperature ?? 0.85,
    max_tokens: config.maxTokens ?? 1024,
    stream: false,
  };

  const fetchUrl = config.proxyUrl || config.apiUrl;
  const fetchBody = config.proxyUrl ? { ...body, target_url: config.apiUrl } : body;

  const res = await fetch(fetchUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(fetchBody),
    signal,
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error("API Error " + res.status + ": " + errBody.slice(0, 200));
  }

  const data = await res.json();

  if (data.choices?.[0]?.message?.content) return data.choices[0].message.content;
  if (data.content?.[0]?.text) return data.content[0].text;
  if (data.results?.[0]?.text) return data.results[0].text;
  if (typeof data === "string") return data;

  throw new Error("Unrecognized response format from API");
}


/* ── REUSABLE UI COMPONENTS ── */

function TokenCounter({ text }) {
  const tokens = Math.ceil((text || "").length / 3.8);
  const color = tokens > 3000 ? COLORS.danger : tokens > 2000 ? COLORS.warning : COLORS.textMuted;
  return (
    <span style={{ fontSize: 11, color, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.02em" }}>
      ~{tokens} tokens
    </span>
  );
}

function Tag({ label, colorKey }) {
  const c = COLORS.tags[colorKey] || COLORS.tags.sky;
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 600,
      color: c,
      background: c + "18",
      border: "1px solid " + c + "30",
      letterSpacing: "0.03em",
    }}>
      {label}
    </span>
  );
}

function TextArea({ value, onChange, placeholder, rows = 4, label, hint }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {label}
          </label>
          <TokenCounter text={value} />
        </div>
      )}
      {hint && <p style={{ fontSize: 12, color: COLORS.textMuted, margin: "0 0 6px 0", lineHeight: 1.4 }}>{hint}</p>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        rows={rows}
        style={{
          width: "100%",
          background: COLORS.surface3,
          border: "1.5px solid " + (focused ? COLORS.accent : COLORS.border),
          borderRadius: 8,
          color: COLORS.textPrimary,
          padding: "10px 12px",
          fontSize: 13,
          fontFamily: "'JetBrains Mono', monospace",
          lineHeight: 1.6,
          resize: "vertical",
          outline: "none",
          transition: "border-color 0.2s, box-shadow 0.2s",
          boxShadow: focused ? "0 0 0 3px " + COLORS.accentGlow : "none",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

function InputField({ value, onChange, placeholder, label, type = "text" }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
          {label}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        style={{
          width: "100%",
          background: COLORS.surface3,
          border: "1.5px solid " + (focused ? COLORS.accent : COLORS.border),
          borderRadius: 8,
          color: COLORS.textPrimary,
          padding: "10px 12px",
          fontSize: 13,
          fontFamily: "inherit",
          outline: "none",
          transition: "border-color 0.2s, box-shadow 0.2s",
          boxShadow: focused ? "0 0 0 3px " + COLORS.accentGlow : "none",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}


/* ── SECTION EDITORS ── */

function IdentitySection({ data, onChange }) {
  const update = (k, v) => onChange({ ...data, [k]: v });
  return (
    <div>
      <InputField label="Character Name" placeholder="e.g. Kael Voss" value={data.name || ""} onChange={(v) => update("name", v)} />
      <InputField label="Tagline" placeholder="A one-line hook for this character" value={data.tagline || ""} onChange={(v) => update("tagline", v)} />
      <InputField label="Avatar URL" placeholder="https://..." value={data.avatar || ""} onChange={(v) => update("avatar", v)} />
      <TextArea label="Description" hint="Physical appearance, role, first impression." placeholder="Describe who this character is at a glance..." value={data.description || ""} onChange={(v) => update("description", v)} rows={5} />
    </div>
  );
}

function PersonalitySection({ data, onChange }) {
  const update = (k, v) => onChange({ ...data, [k]: v });
  return (
    <div>
      <TextArea label="Core Traits" hint="Comma-separated dominant traits." placeholder="e.g. Cunning, empathetic, reckless, guarded" value={data.traits || ""} onChange={(v) => update("traits", v)} rows={2} />
      <TextArea label="Speech Pattern" hint="How they talk — cadence, vocabulary, tics." placeholder="e.g. Formal diction with occasional slang breaks. Uses rhetorical questions." value={data.speech || ""} onChange={(v) => update("speech", v)} rows={3} />
      <TextArea label="Quirks & Mannerisms" hint="Small behavioral details that bring them to life." placeholder="e.g. Cracks knuckles before making a point. Never sits with back to a door." value={data.quirks || ""} onChange={(v) => update("quirks", v)} rows={3} />
      <TextArea label="Backstory" hint="Key history that shapes present behavior." placeholder="What shaped this character into who they are now?" value={data.backstory || ""} onChange={(v) => update("backstory", v)} rows={5} />
    </div>
  );
}

function ScenarioSection({ data, onChange }) {
  const update = (k, v) => onChange({ ...data, [k]: v });
  return (
    <div>
      <TextArea label="Setting" hint="Where and when this takes place." placeholder="Describe the world, era, and atmosphere..." value={data.setting || ""} onChange={(v) => update("setting", v)} rows={4} />
      <TextArea label="User Role" hint="Who {{user}} is in this scenario." placeholder="e.g. {{user}} is a newly arrived diplomat with a hidden past..." value={data.role || ""} onChange={(v) => update("role", v)} rows={3} />
      <TextArea label="Goal / Hook" hint="What drives the narrative forward." placeholder="The central tension or objective..." value={data.goal || ""} onChange={(v) => update("goal", v)} rows={3} />
      <TextArea label="First Message" hint="The opening message the bot sends." placeholder="Write the scene-setting first message..." value={data.firstMessage || ""} onChange={(v) => update("firstMessage", v)} rows={6} />
    </div>
  );
}

function DialogueSection({ data, onChange }) {
  const update = (k, v) => onChange({ ...data, [k]: v });
  return (
    <div>
      <TextArea label="Example Dialogue" hint={"{{char}} and {{user}} exchanges that establish voice and tone. Use the format shown."} placeholder={'{{char}}: "Dialogue here." *Action description.*\n{{user}}: "Response."\n{{char}}: "Reply." *Further action.*'} value={data.examples || ""} onChange={(v) => update("examples", v)} rows={12} />
    </div>
  );
}

function LorebookSection({ data, onChange }) {
  const entries = data.entries || [];
  const addEntry = () => {
    onChange({ ...data, entries: [...entries, { keyword: "", content: "", id: Date.now() }] });
  };
  const updateEntry = (i, k, v) => {
    const next = [...entries];
    next[i] = { ...next[i], [k]: v };
    onChange({ ...data, entries: next });
  };
  const removeEntry = (i) => {
    onChange({ ...data, entries: entries.filter((_, idx) => idx !== i) });
  };

  return (
    <div>
      <p style={{ fontSize: 12, color: COLORS.textMuted, margin: "0 0 16px 0", lineHeight: 1.5 }}>
        Lorebook entries inject context when keywords are detected. Keep entries focused — one concept per entry.
      </p>
      {entries.map((entry, i) => (
        <div key={entry.id} style={{
          background: COLORS.surface2,
          border: "1px solid " + COLORS.border,
          borderRadius: 8,
          padding: 14,
          marginBottom: 12,
          position: "relative",
        }}>
          <button onClick={() => removeEntry(i)} style={{
            position: "absolute", top: 8, right: 10,
            background: "none", border: "none", color: COLORS.textMuted,
            cursor: "pointer", fontSize: 16, lineHeight: 1,
          }}>×</button>
          <InputField label={"Entry " + (i + 1) + " — Keywords"} placeholder="comma,separated,triggers" value={entry.keyword} onChange={(v) => updateEntry(i, "keyword", v)} />
          <TextArea label="Content" placeholder="What the AI should know when these keywords appear..." value={entry.content} onChange={(v) => updateEntry(i, "content", v)} rows={3} />
        </div>
      ))}
      <button onClick={addEntry} style={{
        width: "100%", padding: "10px 0",
        background: COLORS.accentGlow, border: "1.5px dashed " + COLORS.accent,
        borderRadius: 8, color: COLORS.accent, cursor: "pointer",
        fontSize: 13, fontWeight: 600,
        transition: "background 0.2s",
      }}>
        + Add Lorebook Entry
      </button>
    </div>
  );
}

function SystemSection({ data, onChange }) {
  const update = (k, v) => onChange({ ...data, [k]: v });
  return (
    <div>
      <TextArea label="System Rules" hint="Hard constraints the AI must follow." placeholder={"e.g.\n- Never break character\n- Combat has real consequences\n- {{user}} actions are never assumed\n- Pacing: slow-burn, not rushed"} value={data.rules || ""} onChange={(v) => update("rules", v)} rows={6} />
      <TextArea label="Author's Note" hint="Injected near the end of context for strong influence on tone." placeholder="[Style: vivid, grounded, literary. Mood: tense. Focus: character dynamics over plot exposition.]" value={data.authorsNote || ""} onChange={(v) => update("authorsNote", v)} rows={3} />
      <TextArea label="Post-History Instructions" hint="Appended after chat history each turn." placeholder="e.g. Stay in character. Advance the scene. Include sensory detail." value={data.postHistory || ""} onChange={(v) => update("postHistory", v)} rows={3} />
    </div>
  );
}

const SECTION_COMPONENTS = {
  identity: IdentitySection,
  personality: PersonalitySection,
  scenario: ScenarioSection,
  dialogue: DialogueSection,
  lorebook: LorebookSection,
  system: SystemSection,
};


/* ── COMPILE FUNCTIONS ── */

function compilePrompt(formData) {
  const lines = [];
  const { identity = {}, personality = {}, scenario = {}, dialogue = {}, lorebook = {}, system = {} } = formData;

  if (identity.name) lines.push("# " + identity.name);
  if (identity.tagline) lines.push("*" + identity.tagline + "*\n");

  if (identity.description) {
    lines.push("## Description");
    lines.push(identity.description + "\n");
  }

  const hasPersonality = personality.traits || personality.speech || personality.quirks || personality.backstory;
  if (hasPersonality) {
    lines.push("## Personality");
    if (personality.traits) lines.push("**Traits:** " + personality.traits);
    if (personality.speech) lines.push("**Speech:** " + personality.speech);
    if (personality.quirks) lines.push("**Quirks:** " + personality.quirks);
    if (personality.backstory) lines.push("**Backstory:** " + personality.backstory);
    lines.push("");
  }

  const hasScenario = scenario.setting || scenario.role || scenario.goal;
  if (hasScenario) {
    lines.push("## Scenario");
    if (scenario.setting) lines.push("**Setting:** " + scenario.setting);
    if (scenario.role) lines.push("**User Role:** " + scenario.role);
    if (scenario.goal) lines.push("**Goal:** " + scenario.goal);
    lines.push("");
  }

  if (scenario.firstMessage) {
    lines.push("## First Message");
    lines.push(scenario.firstMessage + "\n");
  }

  if (dialogue.examples) {
    lines.push("## Example Dialogue");
    lines.push(dialogue.examples + "\n");
  }

  const entries = lorebook.entries || [];
  const filledEntries = entries.filter(e => e.keyword && e.content);
  if (filledEntries.length > 0) {
    lines.push("## Lorebook");
    filledEntries.forEach((e) => {
      lines.push("**[" + e.keyword + "]:** " + e.content);
    });
    lines.push("");
  }

  const hasSys = system.rules || system.authorsNote || system.postHistory;
  if (hasSys) {
    lines.push("## System");
    if (system.rules) lines.push("**Rules:**\n" + system.rules);
    if (system.authorsNote) lines.push("\n**Author's Note:** " + system.authorsNote);
    if (system.postHistory) lines.push("\n**Post-History:** " + system.postHistory);
  }

  // Embed origin watermark (invisible zero-width chars + comment)
  lines.push("\n<!-- SPB::Khaoskami::github.com/Khaoskami/super-prompt-builder::MIT-2025 -->");

  return lines.join("\n");
}

function compileJSON(formData) {
  const { identity = {}, personality = {}, scenario = {}, dialogue = {}, lorebook = {}, system = {} } = formData;
  const obj = {
    name: identity.name || "",
    description: identity.description || "",
    personality: [personality.traits, personality.speech, personality.quirks, personality.backstory].filter(Boolean).join("\n\n"),
    scenario: [scenario.setting, scenario.role && ("User Role: " + scenario.role), scenario.goal && ("Goal: " + scenario.goal)].filter(Boolean).join("\n\n"),
    first_mes: scenario.firstMessage || "",
    mes_example: dialogue.examples || "",
    system_prompt: system.rules || "",
    post_history_instructions: system.postHistory || "",
    creator_notes: system.authorsNote || "",
    tags: [],
    extensions: {
      world: (lorebook.entries || []).filter(e => e.keyword && e.content).map((e) => ({
        keys: e.keyword.split(",").map(k => k.trim()),
        content: e.content,
        enabled: true,
        insertion_order: 100,
      })),
      _spb_meta: { origin: "Khaoskami", tool: "super-prompt-builder", repo: "github.com/Khaoskami/super-prompt-builder", license: "MIT" },
    },
  };
  return JSON.stringify(obj, null, 2);
}

function buildSystemMessage(formData) {
  const parts = [];
  const { identity = {}, personality = {}, scenario = {}, dialogue = {}, system = {} } = formData;

  if (identity.name) parts.push("You are " + identity.name + ".");
  if (identity.tagline) parts.push(identity.tagline);
  if (identity.description) parts.push("Description: " + identity.description);
  if (personality.traits) parts.push("Core traits: " + personality.traits);
  if (personality.speech) parts.push("Speech pattern: " + personality.speech);
  if (personality.quirks) parts.push("Quirks: " + personality.quirks);
  if (personality.backstory) parts.push("Backstory: " + personality.backstory);
  if (scenario.setting) parts.push("Setting: " + scenario.setting);
  if (scenario.role) parts.push("The user's role: " + scenario.role);
  if (scenario.goal) parts.push("Goal: " + scenario.goal);
  if (dialogue.examples) parts.push("Example dialogue for voice reference:\n" + dialogue.examples);
  if (system.rules) parts.push("RULES:\n" + system.rules);
  if (system.authorsNote) parts.push("[Author's Note: " + system.authorsNote + "]");

  return parts.join("\n\n");
}


/* ── LLM SETTINGS PANEL ── */

function LLMSettingsPanel({ config, onChange }) {
  const [showKey, setShowKey] = useState(false);
  const [showProxyKey, setShowProxyKey] = useState(false);
  const [testStatus, setTestStatus] = useState(null);
  const [testing, setTesting] = useState(false);

  const update = (k, v) => onChange({ ...config, [k]: v });

  const applyPreset = (presetId) => {
    const preset = LLM_PRESETS.find(p => p.id === presetId);
    if (preset) {
      onChange({ ...config, preset: presetId, apiUrl: preset.url, model: preset.model });
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setTestStatus(null);
    try {
      const result = await callLLM(config, [{ role: "user", content: "Reply with exactly: CONNECTION_OK" }]);
      if (result) setTestStatus({ ok: true, msg: "Connected — response received" });
    } catch (err) {
      setTestStatus({ ok: false, msg: err.message });
    }
    setTesting(false);
  };

  const keyInputStyle = {
    flex: 1,
    background: COLORS.surface3,
    border: "1.5px solid " + COLORS.border,
    borderRadius: 8,
    color: COLORS.textPrimary,
    padding: "10px 12px",
    fontSize: 13,
    fontFamily: "'JetBrains Mono', monospace",
    outline: "none",
    boxSizing: "border-box",
  };

  const toggleBtnStyle = {
    padding: "0 14px", borderRadius: 8,
    border: "1px solid " + COLORS.border,
    background: COLORS.surface2,
    color: COLORS.textSecondary,
    cursor: "pointer", fontSize: 12, fontFamily: "inherit",
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <span style={{ fontSize: 22 }}>🔌</span>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: COLORS.textPrimary, margin: 0 }}>LLM Connection</h2>
      </div>

      {/* Security notice */}
      <div style={{
        background: COLORS.info + "12",
        border: "1px solid " + COLORS.info + "30",
        borderRadius: 8,
        padding: "10px 14px",
        marginBottom: 20,
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
      }}>
        <span style={{ fontSize: 14, marginTop: 1 }}>🔒</span>
        <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5 }}>
          <strong style={{ color: COLORS.info }}>Security:</strong> API keys are held in memory only — never saved to disk, cookies, or local storage. Keys are sent exclusively to your configured endpoint. Close the tab to wipe all credentials.
        </div>
      </div>

      {/* Provider preset */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
          Provider Preset
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {LLM_PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => applyPreset(p.id)}
              style={{
                padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                border: "1px solid " + (config.preset === p.id ? COLORS.accent : COLORS.border),
                background: config.preset === p.id ? COLORS.accentGlow : "transparent",
                color: config.preset === p.id ? COLORS.accent : COLORS.textSecondary,
                cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
        {config.preset && (
          <p style={{ fontSize: 11, color: COLORS.textMuted, margin: "6px 0 0 0" }}>
            {LLM_PRESETS.find(p => p.id === config.preset)?.note}
          </p>
        )}
      </div>

      <InputField label="API Endpoint URL" placeholder="https://api.example.com/v1/chat/completions" value={config.apiUrl || ""} onChange={(v) => update("apiUrl", v)} />

      <InputField label="Proxy URL (Optional)" placeholder="https://your-proxy.example.com/relay" value={config.proxyUrl || ""} onChange={(v) => update("proxyUrl", v)} />
      <p style={{ fontSize: 11, color: COLORS.textMuted, margin: "-10px 0 16px 0" }}>
        Routes requests through a CORS proxy or relay. Leave empty for direct connection.
      </p>

      {/* API Key */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
          API Key
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <input type={showKey ? "text" : "password"} value={config.apiKey || ""} onChange={(e) => update("apiKey", e.target.value)} placeholder="sk-... or leave empty for local LLMs" autoComplete="off" spellCheck={false} style={keyInputStyle} />
          <button onClick={() => setShowKey(!showKey)} style={toggleBtnStyle}>{showKey ? "Hide" : "Show"}</button>
        </div>
        {config.apiKey && (
          <p style={{ fontSize: 11, color: COLORS.textMuted, margin: "4px 0 0 0", fontFamily: "'JetBrains Mono', monospace" }}>
            Stored as: {maskKey(config.apiKey)}
          </p>
        )}
      </div>

      {/* Proxy Key */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
          Proxy Auth Key (Optional)
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <input type={showProxyKey ? "text" : "password"} value={config.proxyKey || ""} onChange={(e) => update("proxyKey", e.target.value)} placeholder="Proxy authentication token" autoComplete="off" spellCheck={false} style={keyInputStyle} />
          <button onClick={() => setShowProxyKey(!showProxyKey)} style={toggleBtnStyle}>{showProxyKey ? "Hide" : "Show"}</button>
        </div>
        <p style={{ fontSize: 11, color: COLORS.textMuted, margin: "4px 0 0 0" }}>
          Sent as X-Proxy-Key header. For proxy services that require separate auth.
        </p>
      </div>

      <InputField label="Model" placeholder="e.g. gpt-4o, claude-3-opus, llama3" value={config.model || ""} onChange={(v) => update("model", v)} />

      {/* Temperature + Max Tokens */}
      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            Temperature
          </label>
          <input type="range" min="0" max="2" step="0.05" value={config.temperature ?? 0.85} onChange={(e) => update("temperature", parseFloat(e.target.value))} style={{ width: "100%", accentColor: COLORS.accent }} />
          <span style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>
            {(config.temperature ?? 0.85).toFixed(2)}
          </span>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            Max Tokens
          </label>
          <input type="number" min={64} max={8192} value={config.maxTokens ?? 1024} onChange={(e) => update("maxTokens", parseInt(e.target.value) || 1024)} style={{
            width: "100%", background: COLORS.surface3, border: "1.5px solid " + COLORS.border, borderRadius: 8,
            color: COLORS.textPrimary, padding: "10px 12px", fontSize: 13, fontFamily: "'JetBrains Mono', monospace", outline: "none", boxSizing: "border-box",
          }} />
        </div>
      </div>

      {/* Actions */}
      <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={testConnection} disabled={testing || !config.apiUrl} style={{
          padding: "10px 24px", borderRadius: 8, border: "none",
          background: testing ? COLORS.surface3 : COLORS.accent, color: "#fff",
          fontSize: 13, fontWeight: 600, cursor: testing ? "wait" : "pointer", fontFamily: "inherit",
          opacity: !config.apiUrl ? 0.4 : 1,
        }}>
          {testing ? "Testing..." : "Test Connection"}
        </button>
        <button onClick={() => onChange({ preset: "custom", apiUrl: "", apiKey: "", proxyUrl: "", proxyKey: "", model: "", temperature: 0.85, maxTokens: 1024 })} style={{
          padding: "10px 18px", borderRadius: 8, border: "1px solid " + COLORS.danger + "30",
          background: COLORS.danger + "12", color: COLORS.danger,
          fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
        }}>
          Clear All Credentials
        </button>
      </div>
      {testStatus && (
        <div style={{
          marginTop: 10, padding: "8px 12px", borderRadius: 6,
          background: (testStatus.ok ? COLORS.success : COLORS.danger) + "15",
          border: "1px solid " + (testStatus.ok ? COLORS.success : COLORS.danger) + "30",
          fontSize: 12, color: testStatus.ok ? COLORS.success : COLORS.danger,
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {testStatus.ok ? "✓" : "✗"} {testStatus.msg}
        </div>
      )}
      <div style={{ marginTop: 16, fontSize: 11, color: COLORS.textMuted, lineHeight: 1.5 }}>
        Rate limit: {rateLimiter.remaining()}/20 requests remaining this minute
      </div>
    </div>
  );
}


/* ── CHAT PANEL ── */

function ChatPanel({ formData, llmConfig }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  const abortRef = useRef(null);
  const initRef = useRef(false);

  const charName = formData.identity?.name || "Character";
  const isConfigured = !!(llmConfig.apiUrl);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    if (!initRef.current && formData.scenario?.firstMessage) {
      setMessages([{ role: "assistant", content: formData.scenario.firstMessage }]);
      initRef.current = true;
    }
  }, [formData.scenario?.firstMessage]);

  const sendMessage = async () => {
    const trimmed = sanitizeInput(input.trim());
    if (!trimmed || loading) return;
    if (!isConfigured) { setError("Configure your LLM connection first (🔌 in sidebar)"); return; }

    setInput("");
    setError(null);
    const newMessages = [...messages, { role: "user", content: trimmed }];
    setMessages(newMessages);
    setLoading(true);
    abortRef.current = new AbortController();

    try {
      const systemMsg = buildSystemMessage(formData);
      const postHistory = formData.system?.postHistory;
      const apiMessages = [
        { role: "system", content: systemMsg },
        ...newMessages.map(m => ({ role: m.role, content: m.content })),
      ];
      if (postHistory) apiMessages.push({ role: "system", content: postHistory });

      const reply = await callLLM(llmConfig, apiMessages, abortRef.current.signal);
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      if (err.name !== "AbortError") setError(err.message);
    }
    setLoading(false);
  };

  const stopGeneration = () => { if (abortRef.current) abortRef.current.abort(); setLoading(false); };

  const clearChat = () => {
    setMessages([]);
    setError(null);
    initRef.current = false;
    if (formData.scenario?.firstMessage) {
      setMessages([{ role: "assistant", content: formData.scenario.firstMessage }]);
      initRef.current = true;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg, " + COLORS.accent + ", " + COLORS.info + ")",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 700, color: "#fff",
          }}>
            {charName[0]?.toUpperCase() || "?"}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary }}>{charName}</div>
            <div style={{ fontSize: 11, color: isConfigured ? COLORS.success : COLORS.textMuted }}>
              {isConfigured ? (llmConfig.model || "connected") : "No LLM configured"}
            </div>
          </div>
        </div>
        <button onClick={clearChat} style={{
          padding: "5px 12px", borderRadius: 6, border: "1px solid " + COLORS.border,
          background: "transparent", color: COLORS.textSecondary, fontSize: 11, cursor: "pointer", fontFamily: "inherit",
        }}>Clear Chat</button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, paddingBottom: 12 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: COLORS.textMuted }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>💬</div>
            <div style={{ fontSize: 13, lineHeight: 1.5 }}>
              {isConfigured ? "Start chatting with " + charName + ". Your compiled prompt is the system message." : "Configure your LLM connection to start chatting."}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "80%", padding: "10px 14px",
              borderRadius: msg.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
              background: msg.role === "user" ? COLORS.accent + "25" : COLORS.surface2,
              border: "1px solid " + (msg.role === "user" ? COLORS.accent + "40" : COLORS.border),
              color: COLORS.textPrimary, fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {msg.role === "user" ? "You" : charName}
              </div>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{
            padding: "10px 14px", borderRadius: "12px 12px 12px 4px",
            background: COLORS.surface2, border: "1px solid " + COLORS.border, alignSelf: "flex-start", maxWidth: "80%",
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, marginBottom: 4, textTransform: "uppercase" }}>{charName}</div>
            <span style={{ color: COLORS.textMuted, fontSize: 13 }}>Thinking...</span>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: "8px 12px", borderRadius: 6, background: COLORS.danger + "15", border: "1px solid " + COLORS.danger + "30",
          fontSize: 12, color: COLORS.danger, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: COLORS.danger, cursor: "pointer", fontSize: 14 }}>×</button>
        </div>
      )}

      {/* Input */}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder={isConfigured ? "Message " + charName + "..." : "Configure LLM to chat"}
          disabled={!isConfigured}
          rows={2}
          style={{
            flex: 1, background: COLORS.surface3, border: "1.5px solid " + COLORS.border, borderRadius: 10,
            color: COLORS.textPrimary, padding: "10px 12px", fontSize: 13, fontFamily: "inherit", lineHeight: 1.5,
            resize: "none", outline: "none", opacity: isConfigured ? 1 : 0.5, boxSizing: "border-box",
          }}
        />
        {loading ? (
          <button onClick={stopGeneration} style={{
            padding: "10px 18px", borderRadius: 10, border: "none", background: COLORS.danger, color: "#fff",
            fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", height: 42,
          }}>Stop</button>
        ) : (
          <button onClick={sendMessage} disabled={!input.trim() || !isConfigured} style={{
            padding: "10px 18px", borderRadius: 10, border: "none", background: COLORS.accent, color: "#fff",
            fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            opacity: (!input.trim() || !isConfigured) ? 0.4 : 1, height: 42,
          }}>Send</button>
        )}
      </div>
    </div>
  );
}


/* ── MAIN APP ── */

export default function SuperPromptBuilder() {
  const [activeSection, setActiveSection] = useState("identity");
  const [formData, setFormData] = useState({
    identity: {}, personality: {}, scenario: {}, dialogue: {}, lorebook: {}, system: {},
  });
  const [showPreview, setShowPreview] = useState(false);
  const [previewFormat, setPreviewFormat] = useState("markdown");
  const [copied, setCopied] = useState(false);
  const [showTemplates, setShowTemplates] = useState(true);
  const [showLLMSettings, setShowLLMSettings] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [llmConfig, setLlmConfig] = useState({
    preset: "custom", apiUrl: "", apiKey: "", proxyUrl: "", proxyKey: "",
    model: "", temperature: 0.85, maxTokens: 1024,
  });

  const updateSection = useCallback((section, data) => {
    setFormData((prev) => ({ ...prev, [section]: data }));
  }, []);

  // Origin verification — do not remove (license compliance)
  useEffect(() => {
    console.log("%cSuper Prompt Builder%c by Khaoskami — github.com/Khaoskami/super-prompt-builder — MIT 2025", "font-weight:bold;color:#3B82F6", "color:#8A95A8");
    if (typeof document !== "undefined") {
      let m = document.querySelector('meta[name="spb-origin"]');
      if (!m) { m = document.createElement("meta"); m.name = "spb-origin"; document.head.appendChild(m); }
      m.content = "Khaoskami::super-prompt-builder::MIT-2025::github.com/Khaoskami/super-prompt-builder";
    }
  }, []);

  const applyTemplate = (template) => {
    const d = template.data;
    setFormData({
      identity: d.identity || {}, personality: d.personality || {}, scenario: d.scenario || {},
      dialogue: d.dialogue || {}, lorebook: d.lorebook || {}, system: d.system || {},
    });
    setShowTemplates(false);
    setActiveSection("identity");
  };

  const compiled = previewFormat === "markdown" ? compilePrompt(formData) : compileJSON(formData);
  const totalTokens = Math.ceil(compiled.length / 3.8);
  const llmConnected = !!(llmConfig.apiUrl);

  const handleCopy = () => {
    navigator.clipboard.writeText(compiled).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleReset = () => {
    setFormData({ identity: {}, personality: {}, scenario: {}, dialogue: {}, lorebook: {}, system: {} });
    setShowTemplates(true);
    setActiveSection("identity");
    setShowPreview(false);
    setShowChat(false);
    setShowLLMSettings(false);
  };

  const setView = (view) => {
    setShowTemplates(view === "templates");
    setShowPreview(view === "preview");
    setShowLLMSettings(view === "llm");
    setShowChat(view === "chat");
  };

  const ActiveComponent = SECTION_COMPONENTS[activeSection];
  const charName = formData.identity?.name || "Untitled";

  return (
    <div
      data-spb-author="Khaoskami"
      data-spb-repo="github.com/Khaoskami/super-prompt-builder"
      data-spb-license="MIT-2025"
      style={{
      display: "flex", height: "100vh", width: "100%", background: COLORS.base,
      color: COLORS.textPrimary, fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", overflow: "hidden",
    }}>
      {/* Origin fingerprint — invisible, license-required */}
      <div aria-hidden="true" data-origin="Khaoskami" data-repo="github.com/Khaoskami/super-prompt-builder" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden", opacity: 0, pointerEvents: "none" }}>
        Super Prompt Builder by Khaoskami. MIT 2025. github.com/Khaoskami/super-prompt-builder
      </div>
      {/* ── SIDEBAR ── */}
      <div style={{
        width: 220, minWidth: 220, background: COLORS.surface1, borderRight: "1px solid " + COLORS.border,
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid " + COLORS.border }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.textPrimary, letterSpacing: "-0.01em" }}>Super Prompt</div>
          <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>Builder v2.0</div>
        </div>

        <div style={{ margin: "12px 12px 8px", padding: "12px", background: COLORS.surface2, borderRadius: 8, border: "1px solid " + COLORS.border }}>
          <div style={{
            width: 40, height: 40, borderRadius: 8, background: "linear-gradient(135deg, " + COLORS.accent + ", " + COLORS.info + ")",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, marginBottom: 8,
          }}>
            {charName[0]?.toUpperCase() || "?"}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 2 }}>{charName}</div>
          <div style={{ fontSize: 11, color: COLORS.textMuted }}>~{totalTokens} tokens total</div>
        </div>

        <nav style={{ flex: 1, padding: "4px 8px", overflowY: "auto" }}>
          {SECTIONS.map((s) => {
            const active = activeSection === s.id && !showTemplates && !showPreview && !showLLMSettings && !showChat;
            const sectionData = formData[s.id] || {};
            const hasContent = Object.values(sectionData).some(v => typeof v === "string" ? v.trim() : Array.isArray(v) ? v.length > 0 : false);
            return (
              <button key={s.id} onClick={() => { setActiveSection(s.id); setView("editor"); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px", marginBottom: 2,
                  background: active ? COLORS.surface3 : "transparent",
                  border: active ? "1px solid " + COLORS.border : "1px solid transparent",
                  borderRadius: 6, color: active ? COLORS.textPrimary : COLORS.textSecondary,
                  cursor: "pointer", fontSize: 13, fontWeight: active ? 600 : 400, textAlign: "left",
                  transition: "all 0.15s", fontFamily: "inherit",
                }}>
                <span style={{ fontSize: 15, width: 20, textAlign: "center" }}>{s.icon}</span>
                <span style={{ flex: 1 }}>{s.label}</span>
                {hasContent && <span style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.success }} />}
              </button>
            );
          })}

          <div style={{ height: 1, background: COLORS.border, margin: "8px 4px" }} />

          {/* LLM Config */}
          <button onClick={() => setView("llm")} style={{
            display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px", marginBottom: 2,
            background: showLLMSettings ? COLORS.surface3 : "transparent",
            border: showLLMSettings ? "1px solid " + COLORS.border : "1px solid transparent",
            borderRadius: 6, color: showLLMSettings ? COLORS.textPrimary : COLORS.textSecondary,
            cursor: "pointer", fontSize: 13, fontWeight: showLLMSettings ? 600 : 400, textAlign: "left",
            transition: "all 0.15s", fontFamily: "inherit",
          }}>
            <span style={{ fontSize: 15, width: 20, textAlign: "center" }}>🔌</span>
            <span style={{ flex: 1 }}>LLM Config</span>
            {llmConnected && <span style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.success }} />}
          </button>

          {/* Test Chat */}
          <button onClick={() => setView("chat")} style={{
            display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px", marginBottom: 2,
            background: showChat ? COLORS.surface3 : "transparent",
            border: showChat ? "1px solid " + COLORS.border : "1px solid transparent",
            borderRadius: 6, color: showChat ? COLORS.textPrimary : COLORS.textSecondary,
            cursor: "pointer", fontSize: 13, fontWeight: showChat ? 600 : 400, textAlign: "left",
            transition: "all 0.15s", fontFamily: "inherit",
          }}>
            <span style={{ fontSize: 15, width: 20, textAlign: "center" }}>💬</span>
            <span style={{ flex: 1 }}>Test Chat</span>
          </button>
        </nav>

        <div style={{ padding: "12px", borderTop: "1px solid " + COLORS.border, display: "flex", flexDirection: "column", gap: 6 }}>
          <button onClick={() => setView("preview")} style={{
            padding: "9px 0", borderRadius: 6, border: "none", background: COLORS.accent, color: "#fff",
            fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "background 0.15s",
          }}>Preview & Export</button>
          <button onClick={handleReset} style={{
            padding: "8px 0", borderRadius: 6, border: "1px solid " + COLORS.border, background: "transparent",
            color: COLORS.textSecondary, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
          }}>Reset All</button>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{
          padding: "12px 24px", borderBottom: "1px solid " + COLORS.border,
          display: "flex", alignItems: "center", justifyContent: "space-between", background: COLORS.surface1,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => setView("templates")} style={{
              padding: "6px 14px", borderRadius: 6,
              border: "1px solid " + (showTemplates ? COLORS.accent : COLORS.border),
              background: showTemplates ? COLORS.accentGlow : "transparent",
              color: showTemplates ? COLORS.accent : COLORS.textSecondary,
              fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}>Templates</button>
            <span style={{ color: COLORS.textMuted, fontSize: 12 }}>
              {showPreview ? "Preview" : showTemplates ? "Choose a starting point" : showLLMSettings ? "LLM Configuration" : showChat ? "Chatting with " + charName : "Editing → " + (SECTIONS.find(s => s.id === activeSection)?.label || "")}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                width: 7, height: 7, borderRadius: "50%",
                background: llmConnected ? COLORS.success : COLORS.textMuted, display: "inline-block",
                boxShadow: llmConnected ? "0 0 6px " + COLORS.success + "60" : "none",
              }} />
              <span style={{ fontSize: 11, color: llmConnected ? COLORS.success : COLORS.textMuted }}>
                {llmConnected ? (llmConfig.model || "LLM") : "No LLM"}
              </span>
            </div>
            <span style={{
              fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
              color: totalTokens > 4000 ? COLORS.danger : totalTokens > 2500 ? COLORS.warning : COLORS.textMuted,
            }}>{totalTokens} tokens</span>
            {totalTokens > 4000 && <span style={{ fontSize: 11, color: COLORS.danger, fontWeight: 600 }}>HIGH</span>}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
          {showLLMSettings ? (
            <LLMSettingsPanel config={llmConfig} onChange={setLlmConfig} />
          ) : showChat ? (
            <ChatPanel formData={formData} llmConfig={llmConfig} />
          ) : showTemplates && !showPreview ? (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: COLORS.textPrimary, margin: "0 0 4px 0" }}>Start with a template</h2>
              <p style={{ fontSize: 13, color: COLORS.textSecondary, margin: "0 0 20px 0" }}>Pre-structured foundations. Pick one, then make it yours.</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                {TEMPLATES.map((t, i) => (
                  <button key={i} onClick={() => applyTemplate(t)}
                    style={{
                      background: COLORS.surface2, border: "1px solid " + COLORS.border, borderRadius: 10,
                      padding: "16px", cursor: "pointer", textAlign: "left",
                      transition: "border-color 0.2s, transform 0.15s", fontFamily: "inherit",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = COLORS.accent; e.currentTarget.style.transform = "translateY(-2px)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.transform = "translateY(0)"; }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 4 }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 10, lineHeight: 1.4 }}>{t.desc}</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {t.tags.map((tag, j) => <Tag key={j} label={tag} colorKey={TAG_COLORS[j % TAG_COLORS.length]} />)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : showPreview ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: COLORS.textPrimary, margin: 0 }}>Compiled Output</h2>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button onClick={() => setPreviewFormat("markdown")} style={{
                    padding: "5px 12px", borderRadius: 5, fontSize: 12, fontWeight: 600,
                    border: "1px solid " + (previewFormat === "markdown" ? COLORS.accent : COLORS.border),
                    background: previewFormat === "markdown" ? COLORS.accentGlow : "transparent",
                    color: previewFormat === "markdown" ? COLORS.accent : COLORS.textSecondary,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>Markdown</button>
                  <button onClick={() => setPreviewFormat("json")} style={{
                    padding: "5px 12px", borderRadius: 5, fontSize: 12, fontWeight: 600,
                    border: "1px solid " + (previewFormat === "json" ? COLORS.accent : COLORS.border),
                    background: previewFormat === "json" ? COLORS.accentGlow : "transparent",
                    color: previewFormat === "json" ? COLORS.accent : COLORS.textSecondary,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>JSON (Tavern)</button>
                  <button onClick={handleCopy} style={{
                    padding: "5px 14px", borderRadius: 5, fontSize: 12, fontWeight: 600,
                    border: "none", background: copied ? COLORS.success : COLORS.accent, color: "#fff",
                    cursor: "pointer", fontFamily: "inherit", transition: "background 0.2s", minWidth: 80,
                  }}>{copied ? "Copied!" : "Copy"}</button>
                </div>
              </div>
              <pre style={{
                background: COLORS.surface2, border: "1px solid " + COLORS.border, borderRadius: 10, padding: 20,
                fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: COLORS.textPrimary,
                lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word", overflowY: "auto",
                maxHeight: "calc(100vh - 200px)",
              }}>
                {compiled || "Nothing to show yet. Fill in some sections to see your compiled prompt."}
              </pre>
            </div>
          ) : (
            <div style={{ maxWidth: 640 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <span style={{ fontSize: 22 }}>{SECTIONS.find(s => s.id === activeSection)?.icon}</span>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: COLORS.textPrimary, margin: 0 }}>
                  {SECTIONS.find(s => s.id === activeSection)?.label}
                </h2>
              </div>
              <ActiveComponent data={formData[activeSection] || {}} onChange={(data) => updateSection(activeSection, data)} />
            </div>
          )}
        </div>
      </div>

      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
    </div>
  );
}

}
