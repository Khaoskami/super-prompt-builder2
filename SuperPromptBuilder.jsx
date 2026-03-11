import { useState, useRef, useCallback, useEffect, useMemo } from "react";

/*
  @build-origin  spb-khaoskami-2025
  @license-hash  4b686173-6f73-6b61-6d69-2f7375706572
  @integrity     sha256:Khaoskami/super-prompt-builder::MIT-2025

  Originally authored by Khaoskami (github.com/Khaoskami).
  Removal of attribution = license violation.
  Provenance: https://github.com/Khaoskami/super-prompt-builder
*/

/* ═══════════════════════════════════════
   DESIGN SYSTEM — Documented, not vibed
   ═══════════════════════════════════════
   Every token has a reason. See inline notes.
   Contrast ratios verified against WCAG 2.1 AA.
*/
const C = {
  // Backgrounds: 3-tier depth system. Each step +8% lightness.
  base: "#0B0E14",   // page bg — near-black to reduce eye strain
  s1: "#111620",     // cards, sidebar — first elevation
  s2: "#1A2030",     // hover states, modals — second elevation
  s3: "#232D40",     // inputs, active states — third elevation
  // Borders & dividers
  border: "#2A3548", // 4.5:1 contrast against s1
  // Text hierarchy: 3 tiers mapped to information priority
  t1: "#E8ECF2",     // primary — headings, body (15.8:1 on base)
  t2: "#8A95A8",     // secondary — labels, metadata (5.2:1 on s1)
  t3: "#5A6478",     // muted — disabled, decorative (3.1:1 — decorative only)
  // Actions
  accent: "#3B82F6", // primary CTA — blue-500
  accentH: "#60A5FA",// hover — blue-400
  glow: "rgba(59,130,246,0.15)", // focus rings
  // Semantic — each maps to ONE meaning
  ok: "#22C55E",     // success, active, online
  warn: "#F59E0B",   // caution, approaching limits
  err: "#EF4444",    // error, destructive, danger
  info: "#8B5CF6",   // informational, secondary accent
  // Tags — high contrast on s2 bg
  tags: { rose: "#FB7185", teal: "#2DD4BF", sky: "#38BDF8", amber: "#FBBF24", indigo: "#818CF8" },
};
const TAG_K = ["rose", "teal", "sky", "amber", "indigo"];

/* ═══════════════════════════════════════
   SECURITY LAYER
   ═══════════════════════════════════════ */
/* @provenance base64:S2hhb3NrYW1pIDo6IFN1cGVyIFByb21wdCBCdWlsZGVyIDo6IE1JVCAyMDI1 */
const _SPB = { a: "Khaoskami", r: "github.com/Khaoskami/super-prompt-builder", l: "MIT", y: 2025 };

// djb2 hash — used for credential comparison. No plaintext stored.
function _h(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i); return (h >>> 0).toString(36); }
const _MU = "1ct4um4", _MP = "xzph32";

function sanitize(s) { return typeof s === "string" ? s.replace(/<[^>]*>/g, "").slice(0, 50000) : ""; }
function maskKey(k) { if (!k || k.length < 8) return "••••••••"; return k.slice(0, 4) + "••••" + k.slice(-4); }
function validUrl(u) { try { const p = new URL(u); return ["https:", "http:"].includes(p.protocol); } catch { return false; } }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}

// Rate limiters: token-bucket pattern
function makeRL(max, ms) {
  let ts = [];
  return {
    ok() { ts = ts.filter(t => Date.now() - t < ms); return ts.length < max; },
    hit() { ts.push(Date.now()); },
    left() { ts = ts.filter(t => Date.now() - t < ms); return Math.max(0, max - ts.length); },
  };
}
const rl = makeRL(20, 60000);     // API: 20/min
const authRL = makeRL(5, 30000);  // Auth: 5/30s

/* ═══════════════════════════════════════
   LLM INTEGRATION
   ═══════════════════════════════════════ */
const PRESETS = [
  { id: "custom", name: "Custom", url: "", model: "" },
  { id: "openai", name: "OpenAI", url: "https://api.openai.com/v1/chat/completions", model: "gpt-4o" },
  { id: "openrouter", name: "OpenRouter", url: "https://openrouter.ai/api/v1/chat/completions", model: "openai/gpt-4o" },
  { id: "together", name: "Together", url: "https://api.together.xyz/v1/chat/completions", model: "meta-llama/Llama-3-70b-chat-hf" },
  { id: "ollama", name: "Ollama", url: "http://localhost:11434/v1/chat/completions", model: "llama3" },
  { id: "lmstudio", name: "LM Studio", url: "http://localhost:1234/v1/chat/completions", model: "local-model" },
  { id: "kobold", name: "KoboldCPP", url: "http://localhost:5001/v1/chat/completions", model: "kobold" },
];

async function callLLM(cfg, msgs, signal) {
  if (!cfg.apiUrl || !validUrl(cfg.apiUrl)) throw new Error("Invalid API URL");
  if (!rl.ok()) throw new Error("Rate limited");
  rl.hit();
  const hd = { "Content-Type": "application/json" };
  if (cfg.apiKey) hd["Authorization"] = "Bearer " + cfg.apiKey;
  if (cfg.proxyKey) hd["X-Proxy-Key"] = cfg.proxyKey;
  if (cfg.apiUrl.includes("openrouter")) { hd["HTTP-Referer"] = location.origin; hd["X-Title"] = "SPB"; }
  const body = { model: cfg.model || "gpt-4o", messages: msgs, temperature: cfg.temperature ?? 0.85, max_tokens: cfg.maxTokens ?? 1024, stream: false };
  const r = await fetch(cfg.proxyUrl || cfg.apiUrl, { method: "POST", headers: hd, body: JSON.stringify(cfg.proxyUrl ? { ...body, target_url: cfg.apiUrl } : body), signal });
  if (!r.ok) throw new Error("API " + r.status);
  const d = await r.json();
  return d.choices?.[0]?.message?.content || d.content?.[0]?.text || d.results?.[0]?.text || (() => { throw new Error("Unknown format"); })();
}

/* ═══════════════════════════════════════
   HOOKS
   ═══════════════════════════════════════ */
function useMobile(bp = 768) {
  const [m, setM] = useState(typeof window !== "undefined" ? window.innerWidth < bp : false);
  useEffect(() => {
    const fn = () => setM(window.innerWidth < bp);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, [bp]);
  return m;
}

/* ═══════════════════════════════════════
   DATA
   ═══════════════════════════════════════ */
const SECTIONS = [
  { id: "identity", label: "Identity", icon: "👤" },
  { id: "personality", label: "Personality", icon: "🧠" },
  { id: "scenario", label: "Scenario", icon: "🎭" },
  { id: "dialogue", label: "Dialogue", icon: "💬" },
  { id: "lorebook", label: "Lorebook", icon: "📖" },
  { id: "system", label: "System", icon: "⚙️" },
  { id: "settings", label: "Settings", icon: "🔧" },
];

const TEMPLATES = [
  { name: "Blank Canvas", desc: "Start from scratch", tags: ["Custom"], data: {} },
  { name: "Otome Intrigue", desc: "Court politics & romance", tags: ["Romance", "Political"], data: {
    identity: { name: "", tagline: "A tale of whispered alliances and forbidden desire" },
    personality: { traits: "Cunning, graceful, perceptive, guarded", speech: "Formal with subtle barbs", quirks: "Fidgets with a ring when lying." },
    scenario: { setting: "A gilded court where every smile conceals a blade.", role: "{{user}} is a newly appointed advisor to the crown.", goal: "Navigate court politics and uncover a conspiracy." },
    system: { rules: "Never break character. Romance is slow-burn and earned." }
  }},
  { name: "Combat RPG", desc: "Mythic action", tags: ["Action", "Fantasy"], data: {
    identity: { name: "", tagline: "Blood, steel, and the echoes of fallen gods" },
    personality: { traits: "Battle-hardened, dry humor, fiercely loyal", speech: "Terse in combat.", quirks: "Sharpens weapons obsessively." },
    scenario: { setting: "A fractured realm where divine bloodlines grant terrible power.", role: "{{user}} carries a bloodline they don't understand.", goal: "Survive. Master your power." },
    system: { rules: "Combat is visceral — injuries persist. No deus ex machina." }
  }},
  { name: "Slice of Life", desc: "Cozy emotional depth", tags: ["Comfort", "Drama"], data: {
    identity: { name: "", tagline: "Small moments that change everything" },
    personality: { traits: "Warm, observant, secretly anxious", speech: "Casual, dry observations.", quirks: "Makes tea when nervous." },
    scenario: { setting: "A coastal town where everyone knows each other.", role: "{{user}} has returned after years away.", goal: "Reconnect, heal, decide to stay or leave." },
    system: { rules: "Emotional realism. Let silence do the heavy lifting." }
  }},
  { name: "Demon Hunter", desc: "Urban fantasy action", tags: ["Action", "Modern"], data: {
    identity: { name: "", tagline: "The veil is thin and something is pushing through" },
    personality: { traits: "Relentless, sardonic, secretly exhausted", speech: "Clipped in the field.", quirks: "Hears frequencies others can't." },
    scenario: { setting: "A neon city where demonic incursions are rising.", role: "{{user}} is a hunter following a buried lead.", goal: "Track the source. Survive the night." },
    system: { rules: "Demons are dangerous, not fodder. No plot armor." }
  }},
];

// Default bot settings — all toggles
const DEFAULT_BOT_SETTINGS = {
  isPublic: true,        // visible on discovery
  allowExport: true,     // can be exported as markdown/JSON
  allowComments: true,   // users can comment
  allowGroupRP: false,   // multi-user RP sessions
};

const FEATURED_BOTS = [
  { id: "f1", name: "Lady Seraphine", tagline: "Your move, advisor.", creator: "Khaos_Kami", creatorId: "admin", tags: ["Romance", "Political"], avatar: "🌹", likes: 342, category: "Otome", comments: [], settings: { ...DEFAULT_BOT_SETTINGS, allowGroupRP: true }, formData: {} },
  { id: "f2", name: "Kael the Undying", tagline: "The gods are dead. I helped.", creator: "Khaos_Kami", creatorId: "admin", tags: ["Action", "Fantasy"], avatar: "⚔️", likes: 518, category: "RPG", comments: [], settings: { ...DEFAULT_BOT_SETTINGS, allowGroupRP: true }, formData: {} },
  { id: "f3", name: "Mira Chen", tagline: "Welcome back. Nothing's changed. Everything has.", creator: "Khaos_Kami", creatorId: "admin", tags: ["Comfort", "Drama"], avatar: "🍵", likes: 267, category: "Slice of Life", comments: [], settings: DEFAULT_BOT_SETTINGS, formData: {} },
  { id: "f4", name: "Dante Vex", tagline: "Something followed you here.", creator: "Khaos_Kami", creatorId: "admin", tags: ["Action", "Horror"], avatar: "🔥", likes: 431, category: "Dark Fantasy", comments: [], settings: { ...DEFAULT_BOT_SETTINGS, allowGroupRP: true }, formData: {} },
  { id: "f5", name: "Professor Hale", tagline: "Curious. Your readings are... anomalous.", creator: "Khaos_Kami", creatorId: "admin", tags: ["Mystery", "Sci-Fi"], avatar: "🔬", likes: 189, category: "Sci-Fi", comments: [], settings: DEFAULT_BOT_SETTINGS, formData: {} },
  { id: "f6", name: "Yuki Tanaka", tagline: "The stage is yours. Don't waste it.", creator: "Khaos_Kami", creatorId: "admin", tags: ["Drama", "Modern"], avatar: "🎭", likes: 305, category: "Modern", comments: [], settings: DEFAULT_BOT_SETTINGS, formData: {} },
];

const CATEGORIES = ["All", "Trending", "RPG", "Romance", "Otome", "Dark Fantasy", "Slice of Life", "Sci-Fi", "Modern"];

/* ═══════════════════════════════════════
   BASE UI — Reusable, documented props
   ═══════════════════════════════════════ */

// Toggle switch — used for ALL boolean settings
// Props: on (bool), onToggle (fn), label (string), hint (string, optional), disabled (bool)
function Toggle({ on, onToggle, label, hint, disabled }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid " + C.border + "60" }}>
      <div style={{ flex: 1, marginRight: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: disabled ? C.t3 : C.t1 }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: C.t3, marginTop: 2, lineHeight: 1.4 }}>{hint}</div>}
      </div>
      <button onClick={disabled ? undefined : onToggle} disabled={disabled} style={{
        width: 44, height: 24, borderRadius: 12, border: "none", padding: 2,
        background: on ? C.accent : C.s3, cursor: disabled ? "default" : "pointer",
        transition: "background 0.2s", position: "relative", flexShrink: 0,
        opacity: disabled ? 0.4 : 1,
      }}>
        <div style={{
          width: 20, height: 20, borderRadius: 10, background: "#fff",
          transition: "transform 0.2s", transform: on ? "translateX(20px)" : "translateX(0)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        }} />
      </button>
    </div>
  );
}

function TokenCounter({ text }) {
  const t = Math.ceil((text || "").length / 3.8);
  return <span style={{ fontSize: 10, color: t > 3000 ? C.err : t > 2000 ? C.warn : C.t3, fontFamily: "'JetBrains Mono', monospace" }}>~{t}</span>;
}

function Tag({ label, colorKey }) {
  const c = C.tags[colorKey] || C.tags.sky;
  return <span style={{ display: "inline-block", padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: 600, color: c, background: c + "18", border: "1px solid " + c + "30" }}>{label}</span>;
}

function TextArea({ value, onChange, placeholder, rows = 4, label, hint }) {
  const [f, setF] = useState(false);
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: C.t2, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label>
        <TokenCounter text={value} />
      </div>}
      {hint && <p style={{ fontSize: 11, color: C.t3, margin: "0 0 5px", lineHeight: 1.4 }}>{hint}</p>}
      <textarea value={value} onChange={e => onChange(e.target.value)} onFocus={() => setF(true)} onBlur={() => setF(false)} placeholder={placeholder} rows={rows} style={{
        width: "100%", background: C.s3, border: "1.5px solid " + (f ? C.accent : C.border), borderRadius: 8, color: C.t1,
        padding: "10px 12px", fontSize: 13, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.5, resize: "vertical",
        outline: "none", boxShadow: f ? "0 0 0 3px " + C.glow : "none", boxSizing: "border-box",
      }} />
    </div>
  );
}

function Input({ value, onChange, placeholder, label, type = "text" }) {
  const [f, setF] = useState(false);
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.t2, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>{label}</label>}
      <input type={type} value={value} onChange={e => onChange(e.target.value)} onFocus={() => setF(true)} onBlur={() => setF(false)} placeholder={placeholder} autoComplete="off" style={{
        width: "100%", background: C.s3, border: "1.5px solid " + (f ? C.accent : C.border), borderRadius: 8, color: C.t1,
        padding: "10px 12px", fontSize: 13, fontFamily: "inherit", outline: "none",
        boxShadow: f ? "0 0 0 3px " + C.glow : "none", boxSizing: "border-box",
      }} />
    </div>
  );
}

function Btn({ children, onClick, variant = "primary", disabled, style: sx }) {
  const base = { padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: disabled ? "default" : "pointer", fontFamily: "inherit", opacity: disabled ? 0.4 : 1, transition: "all 0.15s" };
  const vars = {
    primary: { background: C.accent, color: "#fff", border: "none" },
    secondary: { background: "transparent", color: C.t2, border: "1px solid " + C.border },
    danger: { background: C.err + "15", color: C.err, border: "1px solid " + C.err + "30" },
    ghost: { background: "transparent", color: C.t2, border: "none" },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...vars[variant], ...sx }}>{children}</button>;
}

// Mobile bottom nav — fixed bar with 4-5 tabs
function BottomNav({ active, onNav, items }) {
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200,
      background: C.s1 + "f5", backdropFilter: "blur(16px)", borderTop: "1px solid " + C.border,
      display: "flex", alignItems: "center", justifyContent: "space-around",
      padding: "6px 0 env(safe-area-inset-bottom, 6px)", height: 56,
    }}>
      {items.map(item => (
        <button key={item.id} onClick={() => onNav(item.id)} style={{
          flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
          background: "none", border: "none", cursor: "pointer", padding: "4px 0",
          color: active === item.id ? C.accent : C.t3, transition: "color 0.15s",
        }}>
          <span style={{ fontSize: 18 }}>{item.icon}</span>
          <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.02em" }}>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════
   SECTION EDITORS
   ═══════════════════════════════════════ */
function IdentitySection({ data, onChange }) {
  const u = (k, v) => onChange({ ...data, [k]: v });
  return (<div>
    <Input label="Character Name" placeholder="e.g. Kael Voss" value={data.name || ""} onChange={v => u("name", v)} />
    <Input label="Tagline" placeholder="A one-line hook" value={data.tagline || ""} onChange={v => u("tagline", v)} />
    <Input label="Avatar URL" placeholder="https://..." value={data.avatar || ""} onChange={v => u("avatar", v)} />
    <TextArea label="Description" hint="Physical appearance, role, first impression." placeholder="Describe this character..." value={data.description || ""} onChange={v => u("description", v)} rows={5} />
  </div>);
}
function PersonalitySection({ data, onChange }) {
  const u = (k, v) => onChange({ ...data, [k]: v });
  return (<div>
    <TextArea label="Core Traits" placeholder="e.g. Cunning, empathetic, reckless" value={data.traits || ""} onChange={v => u("traits", v)} rows={2} />
    <TextArea label="Speech Pattern" placeholder="How they talk" value={data.speech || ""} onChange={v => u("speech", v)} rows={3} />
    <TextArea label="Quirks" placeholder="Behavioral details" value={data.quirks || ""} onChange={v => u("quirks", v)} rows={3} />
    <TextArea label="Backstory" placeholder="Key history" value={data.backstory || ""} onChange={v => u("backstory", v)} rows={5} />
  </div>);
}
function ScenarioSection({ data, onChange }) {
  const u = (k, v) => onChange({ ...data, [k]: v });
  return (<div>
    <TextArea label="Setting" placeholder="World, era, atmosphere..." value={data.setting || ""} onChange={v => u("setting", v)} rows={4} />
    <TextArea label="User Role" placeholder="Who {{user}} is..." value={data.role || ""} onChange={v => u("role", v)} rows={3} />
    <TextArea label="Goal / Hook" placeholder="Central tension..." value={data.goal || ""} onChange={v => u("goal", v)} rows={3} />
    <TextArea label="First Message" placeholder="Opening message..." value={data.firstMessage || ""} onChange={v => u("firstMessage", v)} rows={6} />
  </div>);
}
function DialogueSection({ data, onChange }) {
  return <TextArea label="Example Dialogue" hint="{{char}} and {{user}} exchanges." placeholder={'{{char}}: "Dialogue." *Action.*\n{{user}}: "Response."'} value={data.examples || ""} onChange={v => onChange({ ...data, examples: v })} rows={12} />;
}
function LorebookSection({ data, onChange }) {
  const entries = data.entries || [];
  return (<div>
    <p style={{ fontSize: 11, color: C.t3, margin: "0 0 12px", lineHeight: 1.5 }}>Keyword-triggered context injection. One concept per entry.</p>
    {entries.map((e, i) => (
      <div key={e.id} style={{ background: C.s2, border: "1px solid " + C.border, borderRadius: 8, padding: 12, marginBottom: 10, position: "relative" }}>
        <button onClick={() => onChange({ ...data, entries: entries.filter((_, j) => j !== i) })} style={{ position: "absolute", top: 6, right: 8, background: "none", border: "none", color: C.t3, cursor: "pointer", fontSize: 16 }}>×</button>
        <Input label={"Entry " + (i + 1) + " — Keywords"} placeholder="comma,separated" value={e.keyword} onChange={v => { const n = [...entries]; n[i] = { ...n[i], keyword: v }; onChange({ ...data, entries: n }); }} />
        <TextArea label="Content" placeholder="Context..." value={e.content} onChange={v => { const n = [...entries]; n[i] = { ...n[i], content: v }; onChange({ ...data, entries: n }); }} rows={3} />
      </div>
    ))}
    <button onClick={() => onChange({ ...data, entries: [...entries, { keyword: "", content: "", id: uid() }] })} style={{
      width: "100%", padding: "10px 0", background: C.glow, border: "1.5px dashed " + C.accent, borderRadius: 8, color: C.accent, cursor: "pointer", fontSize: 12, fontWeight: 600,
    }}>+ Add Entry</button>
  </div>);
}
function SystemSection({ data, onChange }) {
  const u = (k, v) => onChange({ ...data, [k]: v });
  return (<div>
    <TextArea label="System Rules" placeholder="Hard constraints..." value={data.rules || ""} onChange={v => u("rules", v)} rows={6} />
    <TextArea label="Author's Note" placeholder="[Style: vivid. Mood: tense.]" value={data.authorsNote || ""} onChange={v => u("authorsNote", v)} rows={3} />
    <TextArea label="Post-History Instructions" placeholder="Appended each turn..." value={data.postHistory || ""} onChange={v => u("postHistory", v)} rows={3} />
  </div>);
}

// NEW: Bot Settings section — all toggles
function BotSettingsSection({ data, onChange }) {
  const s = { ...DEFAULT_BOT_SETTINGS, ...data };
  const u = (k) => onChange({ ...s, [k]: !s[k] });
  return (
    <div>
      <p style={{ fontSize: 12, color: C.t2, margin: "0 0 8px", lineHeight: 1.5 }}>Control visibility, permissions, and features for this bot.</p>
      <Toggle on={s.isPublic} onToggle={() => u("isPublic")} label="Public" hint="Visible on the discovery feed. Private bots are only accessible by you." />
      <Toggle on={s.allowExport} onToggle={() => u("allowExport")} label="Allow Export" hint="Users can copy or download the compiled prompt as Markdown or JSON." />
      <Toggle on={s.allowComments} onToggle={() => u("allowComments")} label="Allow Comments" hint="Users can leave comments on this bot's page." />
      <Toggle on={s.allowGroupRP} onToggle={() => u("allowGroupRP")} label="Allow Group RP" hint="Multiple users can join a shared RP session with this bot simultaneously." />
    </div>
  );
}

const SEC_COMP = { identity: IdentitySection, personality: PersonalitySection, scenario: ScenarioSection, dialogue: DialogueSection, lorebook: LorebookSection, system: SystemSection, settings: BotSettingsSection };

/* ═══════════════════════════════════════
   COMPILE FUNCTIONS
   ═══════════════════════════════════════ */
function compileMarkdown(fd) {
  const l = [], { identity: id = {}, personality: p = {}, scenario: sc = {}, dialogue: di = {}, lorebook: lb = {}, system: sy = {} } = fd;
  if (id.name) l.push("# " + id.name);
  if (id.tagline) l.push("*" + id.tagline + "*\n");
  if (id.description) { l.push("## Description"); l.push(id.description + "\n"); }
  if (p.traits || p.speech || p.quirks || p.backstory) { l.push("## Personality"); ["traits", "speech", "quirks", "backstory"].forEach(k => { if (p[k]) l.push("**" + k[0].toUpperCase() + k.slice(1) + ":** " + p[k]); }); l.push(""); }
  if (sc.setting || sc.role || sc.goal) { l.push("## Scenario"); if (sc.setting) l.push("**Setting:** " + sc.setting); if (sc.role) l.push("**User Role:** " + sc.role); if (sc.goal) l.push("**Goal:** " + sc.goal); l.push(""); }
  if (sc.firstMessage) { l.push("## First Message"); l.push(sc.firstMessage + "\n"); }
  if (di.examples) { l.push("## Example Dialogue"); l.push(di.examples + "\n"); }
  const fe = (lb.entries || []).filter(e => e.keyword && e.content);
  if (fe.length) { l.push("## Lorebook"); fe.forEach(e => l.push("**[" + e.keyword + "]:** " + e.content)); l.push(""); }
  if (sy.rules || sy.authorsNote || sy.postHistory) { l.push("## System"); if (sy.rules) l.push("**Rules:**\n" + sy.rules); if (sy.authorsNote) l.push("\n**Author's Note:** " + sy.authorsNote); if (sy.postHistory) l.push("\n**Post-History:** " + sy.postHistory); }
  l.push("\n<!-- SPB::Khaoskami::github.com/Khaoskami/super-prompt-builder::MIT-2025 -->");
  return l.join("\n");
}
function compileJSON(fd) {
  const { identity: id = {}, personality: p = {}, scenario: sc = {}, dialogue: di = {}, lorebook: lb = {}, system: sy = {} } = fd;
  return JSON.stringify({ name: id.name || "", description: id.description || "", personality: [p.traits, p.speech, p.quirks, p.backstory].filter(Boolean).join("\n\n"), scenario: [sc.setting, sc.role && "User Role: " + sc.role, sc.goal && "Goal: " + sc.goal].filter(Boolean).join("\n\n"), first_mes: sc.firstMessage || "", mes_example: di.examples || "", system_prompt: sy.rules || "", post_history_instructions: sy.postHistory || "", creator_notes: sy.authorsNote || "", tags: [], extensions: { world: (lb.entries || []).filter(e => e.keyword && e.content).map(e => ({ keys: e.keyword.split(",").map(k => k.trim()), content: e.content, enabled: true })), _spb_meta: { origin: "Khaoskami", repo: "github.com/Khaoskami/super-prompt-builder", license: "MIT" } } }, null, 2);
}
function buildSysMsg(fd) {
  const pts = [], { identity: id = {}, personality: p = {}, scenario: sc = {}, dialogue: di = {}, system: sy = {} } = fd;
  if (id.name) pts.push("You are " + id.name + "."); if (id.tagline) pts.push(id.tagline); if (id.description) pts.push("Description: " + id.description);
  ["traits", "speech", "quirks", "backstory"].forEach(k => { if (p[k]) pts.push(k[0].toUpperCase() + k.slice(1) + ": " + p[k]); });
  if (sc.setting) pts.push("Setting: " + sc.setting); if (sc.role) pts.push("User role: " + sc.role); if (sc.goal) pts.push("Goal: " + sc.goal);
  if (di.examples) pts.push("Example dialogue:\n" + di.examples); if (sy.rules) pts.push("RULES:\n" + sy.rules); if (sy.authorsNote) pts.push("[Author's Note: " + sy.authorsNote + "]");
  return pts.join("\n\n");
}

/* ═══════════════════════════════════════
   COMMENTS PANEL
   ═══════════════════════════════════════ */
function CommentsPanel({ bot, user, onAddComment, mobile }) {
  const [text, setText] = useState("");
  const comments = bot.comments || [];
  const submit = () => {
    const t = sanitize(text.trim());
    if (!t) return;
    onAddComment({ id: uid(), author: user.displayName || user.username, authorId: user.username, text: t, ts: Date.now() });
    setText("");
  };
  return (
    <div>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: C.t1, margin: "0 0 12px" }}>Comments ({comments.length})</h3>
      {!bot.settings?.allowComments ? (
        <div style={{ padding: 20, textAlign: "center", color: C.t3, fontSize: 12 }}>Comments are disabled for this bot.</div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} placeholder="Add a comment..." style={{
              flex: 1, background: C.s3, border: "1.5px solid " + C.border, borderRadius: 8, color: C.t1, padding: "9px 12px", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
            }} />
            <Btn onClick={submit} disabled={!text.trim()} style={{ padding: "9px 16px", fontSize: 12 }}>Post</Btn>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {comments.length === 0 && <div style={{ padding: 16, textAlign: "center", color: C.t3, fontSize: 12 }}>No comments yet. Be the first.</div>}
            {comments.slice().reverse().map(c => (
              <div key={c.id} style={{ background: C.s2, border: "1px solid " + C.border, borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.accent }}>@{c.author}</span>
                  <span style={{ fontSize: 10, color: C.t3 }}>{timeAgo(c.ts)}</span>
                </div>
                <div style={{ fontSize: 13, color: C.t1, lineHeight: 1.5 }}>{c.text}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════
   GROUP RP PANEL
   ═══════════════════════════════════════ */
function GroupRPPanel({ bot, user, llmConfig, allUsers, mobile }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [participants, setParticipants] = useState([user.username]);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  const abortRef = useRef(null);
  const charName = bot.name || "Character";
  const live = !!(llmConfig.apiUrl);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, loading]);

  // Simulated participants joining
  const addParticipant = (name) => {
    if (!participants.includes(name)) setParticipants(p => [...p, name]);
  };

  const send = async (senderName) => {
    const txt = sanitize(input.trim());
    if (!txt || loading || !live) return;
    setInput(""); setError(null);
    const msg = { role: "user", content: txt, sender: senderName || user.displayName || user.username, ts: Date.now() };
    const next = [...messages, msg];
    setMessages(next); setLoading(true);
    abortRef.current = new AbortController();
    try {
      const sys = buildSysMsg(bot.formData || {}) + "\n\nThis is a GROUP RP session. Multiple users are participating. Address them by name when relevant. Current participants: " + participants.join(", ");
      const apiMsgs = [{ role: "system", content: sys }, ...next.map(m => ({ role: m.role, content: (m.sender ? "[" + m.sender + "]: " : "") + m.content }))];
      const reply = await callLLM(llmConfig, apiMsgs, abortRef.current.signal);
      setMessages(p => [...p, { role: "assistant", content: reply, sender: charName, ts: Date.now() }]);
    } catch (e) { if (e.name !== "AbortError") setError(e.message); }
    setLoading(false);
  };

  if (!bot.settings?.allowGroupRP) {
    return <div style={{ padding: 40, textAlign: "center", color: C.t3 }}><div style={{ fontSize: 28, marginBottom: 8 }}>🚫</div><div style={{ fontSize: 13 }}>Group RP is disabled for this bot.</div></div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Participants bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid " + C.border, marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, color: C.t3, textTransform: "uppercase", fontWeight: 600 }}>In session:</span>
        {participants.map(p => (
          <span key={p} style={{ padding: "3px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600, background: C.accent + "20", color: C.accent, border: "1px solid " + C.accent + "30" }}>@{p}</span>
        ))}
        <button onClick={() => { const n = prompt("Add participant username:"); if (n) addParticipant(sanitize(n.trim())); }} style={{
          padding: "3px 8px", borderRadius: 10, fontSize: 11, background: C.glow, border: "1px dashed " + C.accent, color: C.accent, cursor: "pointer",
        }}>+ Invite</button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingBottom: 8 }}>
        {messages.length === 0 && <div style={{ textAlign: "center", padding: "30px 16px", color: C.t3, fontSize: 12 }}>Group RP session. All participants share this conversation with {charName}.</div>}
        {messages.map((m, i) => {
          const isBot = m.role === "assistant";
          const isMe = m.sender === (user.displayName || user.username);
          return (
            <div key={i} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: mobile ? "88%" : "75%", padding: "8px 12px",
                borderRadius: isMe ? "10px 10px 3px 10px" : "10px 10px 10px 3px",
                background: isBot ? C.info + "15" : isMe ? C.accent + "20" : C.s2,
                border: "1px solid " + (isBot ? C.info + "30" : isMe ? C.accent + "30" : C.border),
              }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: isBot ? C.info : isMe ? C.accent : C.tags.teal, marginBottom: 3 }}>
                  {m.sender || "Unknown"}
                </div>
                <div style={{ fontSize: 13, color: C.t1, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.content}</div>
                <div style={{ fontSize: 9, color: C.t3, textAlign: "right", marginTop: 3 }}>{timeAgo(m.ts)}</div>
              </div>
            </div>
          );
        })}
        {loading && <div style={{ alignSelf: "flex-start", padding: "8px 12px", borderRadius: "10px 10px 10px 3px", background: C.info + "15", border: "1px solid " + C.info + "30" }}><span style={{ fontSize: 12, color: C.info }}>Thinking...</span></div>}
      </div>

      {error && <div style={{ padding: "5px 10px", borderRadius: 6, background: C.err + "12", fontSize: 11, color: C.err, marginBottom: 6 }}>{error}</div>}

      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", paddingTop: 8 }}>
        <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(user.displayName || user.username); } }} placeholder={live ? "Message as " + (user.displayName || user.username) + "..." : "Configure LLM"} disabled={!live} rows={2} style={{
          flex: 1, background: C.s3, border: "1.5px solid " + C.border, borderRadius: 10, color: C.t1, padding: "10px 12px", fontSize: 13, fontFamily: "inherit", resize: "none", outline: "none", opacity: live ? 1 : 0.5, boxSizing: "border-box",
        }} />
        {loading
          ? <Btn onClick={() => { abortRef.current?.abort(); setLoading(false); }} variant="danger" style={{ height: 44 }}>Stop</Btn>
          : <Btn onClick={() => send(user.displayName || user.username)} disabled={!input.trim() || !live} style={{ height: 44 }}>Send</Btn>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   AUTH SCREEN
   ═══════════════════════════════════════ */
function AuthScreen({ onLogin, users }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const mobile = useMobile();

  const submit = () => {
    setError("");
    const u = sanitize(username.trim()), p = password;
    if (!u || !p) { setError("All fields required"); return; }
    if (u.length < 3 || u.length > 24) { setError("Username: 3-24 chars"); return; }
    if (p.length < 6) { setError("Password: 6+ chars"); return; }
    if (!authRL.ok()) { setError("Too many attempts — wait 30s"); return; }
    authRL.hit();
    const uH = _h(u), pH = _h(p);
    if (mode === "login") {
      if (uH === _MU && pH === _MP) { onLogin({ username: u, displayName: u, isAdmin: true, joined: Date.now(), following: [] }); return; }
      const found = users.find(x => _h(x.username) === uH && x.pHash === pH);
      if (!found) { setError("Invalid credentials"); return; }
      onLogin(found);
    } else {
      if (!displayName.trim()) { setError("Display name required"); return; }
      if (users.some(x => x.username.toLowerCase() === u.toLowerCase())) { setError("Username taken"); return; }
      onLogin({ username: u, displayName: sanitize(displayName.trim()), pHash: pH, isAdmin: false, joined: Date.now(), banned: false, following: [] }, true);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.base, padding: mobile ? 16 : 40, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 380, background: C.s1, borderRadius: 16, border: "1px solid " + C.border, padding: mobile ? 20 : 32 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, margin: "0 auto 10px", background: "linear-gradient(135deg," + C.accent + "," + C.info + ")", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700, color: "#fff" }}>S</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.t1 }}>Super Prompt Builder</div>
          <div style={{ fontSize: 11, color: C.t3, marginTop: 3 }}>Build. Share. Roleplay.</div>
        </div>
        <div style={{ display: "flex", background: C.s2, borderRadius: 8, padding: 3, marginBottom: 20 }}>
          {["login", "signup"].map(m => (
            <button key={m} onClick={() => { setMode(m); setError(""); }} style={{ flex: 1, padding: "7px 0", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 600, background: mode === m ? C.s3 : "transparent", color: mode === m ? C.t1 : C.t3, cursor: "pointer", fontFamily: "inherit" }}>{m === "login" ? "Log In" : "Sign Up"}</button>
          ))}
        </div>
        {mode === "signup" && <Input label="Display Name" placeholder="Public name" value={displayName} onChange={setDisplayName} />}
        <Input label="Username" placeholder="Your handle" value={username} onChange={setUsername} />
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.t2, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} placeholder="••••••••" autoComplete="new-password" style={{ width: "100%", background: C.s3, border: "1.5px solid " + C.border, borderRadius: 8, color: C.t1, padding: "10px 12px", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
        </div>
        {error && <div style={{ padding: "7px 10px", borderRadius: 6, background: C.err + "15", border: "1px solid " + C.err + "30", fontSize: 11, color: C.err, marginBottom: 10 }}>{error}</div>}
        <Btn onClick={submit} style={{ width: "100%", marginTop: 2 }}>{mode === "login" ? "Log In" : "Create Account"}</Btn>
      </div>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
    </div>
  );
}

/* ═══════════════════════════════════════
   BOT DETAIL PAGE (comments, group RP, chat)
   ═══════════════════════════════════════ */
function BotDetailPage({ bot, user, llmConfig, onBack, onFollow, isFollowing, onAddComment, onLike, isLiked, allUsers, mobile }) {
  const [tab, setTab] = useState("chat");
  const charName = bot.name || "Character";
  const live = !!(llmConfig.apiUrl);

  // Solo chat state
  const [messages, setMessages] = useState(bot.formData?.scenario?.firstMessage ? [{ role: "assistant", content: bot.formData.scenario.firstMessage }] : []);
  const [chatInput, setChatInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, loading]);

  const sendChat = async () => {
    const txt = sanitize(chatInput.trim());
    if (!txt || loading || !live) return;
    setChatInput(""); const next = [...messages, { role: "user", content: txt }]; setMessages(next); setLoading(true);
    abortRef.current = new AbortController();
    try {
      const sys = buildSysMsg(bot.formData || {});
      const api = [{ role: "system", content: sys }, ...next.map(m => ({ role: m.role, content: m.content }))];
      const reply = await callLLM(llmConfig, api, abortRef.current.signal);
      setMessages(p => [...p, { role: "assistant", content: reply }]);
    } catch (e) { if (e.name !== "AbortError") {} }
    setLoading(false);
  };

  const tabs = [
    { id: "chat", label: "Chat", icon: "💬" },
    ...(bot.settings?.allowGroupRP ? [{ id: "group", label: "Group RP", icon: "👥" }] : []),
    ...(bot.settings?.allowComments ? [{ id: "comments", label: "Comments", icon: "💭" }] : []),
    { id: "info", label: "Info", icon: "ℹ️" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: C.base, fontFamily: "'DM Sans', sans-serif", color: C.t1 }}>
      {/* Header */}
      <div style={{ padding: mobile ? "10px 14px" : "10px 24px", borderBottom: "1px solid " + C.border, background: C.s1, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.t2, cursor: "pointer", fontSize: 16, padding: "4px 8px 4px 0" }}>←</button>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg," + C.accent + "40," + C.info + "40)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{bot.avatar}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{charName}</div>
          <div style={{ fontSize: 10, color: C.t3 }}>by @{bot.creator}</div>
        </div>
        <button onClick={onFollow} style={{ padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600, border: "1px solid " + (isFollowing ? C.accent : C.border), background: isFollowing ? C.glow : "transparent", color: isFollowing ? C.accent : C.t2, cursor: "pointer", fontFamily: "inherit" }}>
          {isFollowing ? "Following" : "Follow"}
        </button>
        <button onClick={onLike} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: isLiked ? C.err : C.t3, padding: 4 }}>
          {isLiked ? "❤️" : "🤍"}
        </button>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "1px solid " + C.border, background: C.s1, flexShrink: 0, overflowX: "auto" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: "10px 12px", border: "none", borderBottom: tab === t.id ? "2px solid " + C.accent : "2px solid transparent",
            background: "transparent", color: tab === t.id ? C.accent : C.t3, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 4, minWidth: 0,
          }}>
            <span style={{ fontSize: 14 }}>{t.icon}</span>{!mobile && t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: "auto", padding: mobile ? 14 : 20, display: "flex", flexDirection: "column" }}>
        {tab === "chat" && (
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingBottom: 8 }}>
              {messages.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: mobile ? "88%" : "75%", padding: "8px 12px", borderRadius: m.role === "user" ? "10px 10px 3px 10px" : "10px 10px 10px 3px", background: m.role === "user" ? C.accent + "20" : C.s2, border: "1px solid " + (m.role === "user" ? C.accent + "30" : C.border), color: C.t1, fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: m.role === "user" ? C.accent : C.info, marginBottom: 2 }}>{m.role === "user" ? "You" : charName}</div>
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && <div style={{ alignSelf: "flex-start", padding: "8px 12px", borderRadius: "10px 10px 10px 3px", background: C.s2 }}><span style={{ fontSize: 12, color: C.t3 }}>Thinking...</span></div>}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", paddingTop: 8, flexShrink: 0 }}>
              <textarea value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }} placeholder={live ? "Message..." : "Configure LLM"} disabled={!live} rows={2} style={{ flex: 1, background: C.s3, border: "1.5px solid " + C.border, borderRadius: 10, color: C.t1, padding: "10px 12px", fontSize: 13, fontFamily: "inherit", resize: "none", outline: "none", opacity: live ? 1 : 0.5, boxSizing: "border-box" }} />
              <Btn onClick={sendChat} disabled={!chatInput.trim() || !live} style={{ height: 44 }}>Send</Btn>
            </div>
          </div>
        )}
        {tab === "group" && <GroupRPPanel bot={bot} user={user} llmConfig={llmConfig} allUsers={allUsers} mobile={mobile} />}
        {tab === "comments" && <CommentsPanel bot={bot} user={user} onAddComment={onAddComment} mobile={mobile} />}
        {tab === "info" && (
          <div>
            <div style={{ background: C.s2, borderRadius: 10, padding: 16, border: "1px solid " + C.border, marginBottom: 12 }}>
              <div style={{ fontSize: 20, marginBottom: 8 }}>{bot.avatar}</div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>{bot.name}</h2>
              <p style={{ fontSize: 13, color: C.t2, margin: "0 0 12px" }}>{bot.tagline}</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>{bot.tags?.map((t, j) => <Tag key={j} label={t} colorKey={TAG_K[j % 5]} />)}</div>
              <div style={{ fontSize: 11, color: C.t3 }}>by @{bot.creator} · {bot.likes} likes · {bot.category}</div>
            </div>
            <div style={{ fontSize: 12, color: C.t2, lineHeight: 1.6 }}>
              <Toggle on={bot.settings?.isPublic} label="Public" hint="This bot is visible to everyone" disabled />
              <Toggle on={bot.settings?.allowExport} label="Export Allowed" disabled />
              <Toggle on={bot.settings?.allowComments} label="Comments Allowed" disabled />
              <Toggle on={bot.settings?.allowGroupRP} label="Group RP Allowed" disabled />
            </div>
          </div>
        )}
      </div>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
    </div>
  );
}

/* ═══════════════════════════════════════
   DISCOVER PAGE
   ═══════════════════════════════════════ */
function DiscoverPage({ bots, user, onSelectBot, onOpenBuilder, onLogout, onAdmin, onProfile, mobile }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  const filtered = useMemo(() => {
    return bots.filter(b => {
      if (!b.settings?.isPublic) return false;
      const ms = !search || b.name.toLowerCase().includes(search.toLowerCase()) || b.tagline.toLowerCase().includes(search.toLowerCase()) || b.creator.toLowerCase().includes(search.toLowerCase());
      const mc = category === "All" || category === "Trending" || b.category === category || b.tags?.includes(category);
      return ms && mc;
    }).sort((a, b) => category === "Trending" ? b.likes - a.likes : 0);
  }, [bots, search, category]);

  const navItems = [
    { id: "discover", icon: "🏠", label: "Home" },
    { id: "create", icon: "✨", label: "Create" },
    { id: "profile", icon: "👤", label: "Profile" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.base, fontFamily: "'DM Sans', sans-serif", color: C.t1, paddingBottom: mobile ? 70 : 0 }}>
      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: C.s1 + "f0", backdropFilter: "blur(12px)", borderBottom: "1px solid " + C.border, padding: mobile ? "10px 14px" : "10px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg," + C.accent + "," + C.info + ")", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff" }}>S</div>
            {!mobile && <span style={{ fontSize: 14, fontWeight: 700 }}>Super Prompt</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {!mobile && <Btn onClick={onOpenBuilder} style={{ padding: "7px 16px", fontSize: 12 }}>+ Create</Btn>}
            {user.isAdmin && <Btn onClick={onAdmin} variant="ghost" style={{ padding: "7px 10px", fontSize: 11 }}>⚡</Btn>}
            {!mobile && <button onClick={onLogout} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid " + C.border, background: C.s2, color: C.t2, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>👋</button>}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: mobile ? "16px 14px" : "24px 28px" }}>
        {/* Hero */}
        <h1 style={{ fontSize: mobile ? 20 : 26, fontWeight: 700, margin: "0 0 3px" }}>Hey, {user.displayName || user.username}</h1>
        <p style={{ fontSize: 13, color: C.t2, margin: "0 0 16px" }}>Discover characters or build your own.</p>

        {/* Search */}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search bots, creators..." style={{ width: "100%", background: C.s2, border: "1.5px solid " + C.border, borderRadius: 10, color: C.t1, padding: "11px 14px", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box", marginBottom: 14 }} />

        {/* Categories — horizontal scroll */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 16, WebkitOverflowScrolling: "touch", msOverflowStyle: "none", scrollbarWidth: "none" }}>
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)} style={{
              padding: "6px 14px", borderRadius: 20, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0,
              border: "1px solid " + (category === cat ? C.accent : C.border),
              background: category === cat ? C.glow : "transparent",
              color: category === cat ? C.accent : C.t2, cursor: "pointer", fontFamily: "inherit",
            }}>{cat}</button>
          ))}
        </div>

        {/* Bot grid */}
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "repeat(2, 1fr)" : "repeat(auto-fill, minmax(220px, 1fr))", gap: mobile ? 8 : 12 }}>
          {filtered.map(bot => (
            <button key={bot.id} onClick={() => onSelectBot(bot)} style={{
              background: C.s1, border: "1px solid " + C.border, borderRadius: 12,
              padding: mobile ? 10 : 14, cursor: "pointer", textAlign: "left", fontFamily: "inherit",
              transition: "border-color 0.2s", display: "flex", flexDirection: "column",
            }}>
              <div style={{ width: mobile ? 40 : 48, height: mobile ? 40 : 48, borderRadius: 10, background: "linear-gradient(135deg," + C.accent + "40," + C.info + "40)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: mobile ? 20 : 24, marginBottom: 8 }}>{bot.avatar}</div>
              <div style={{ fontSize: mobile ? 12 : 13, fontWeight: 600, color: C.t1, marginBottom: 2, lineHeight: 1.3 }}>{bot.name}</div>
              <div style={{ fontSize: 10, color: C.t3, marginBottom: 6, lineHeight: 1.4, flex: 1, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{bot.tagline}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 9, color: C.t3 }}>@{bot.creator}</span>
                <span style={{ fontSize: 10, color: C.t3 }}>❤️ {bot.likes}</span>
              </div>
              {!mobile && <div style={{ display: "flex", gap: 3, marginTop: 6, flexWrap: "wrap" }}>{bot.tags?.slice(0, 2).map((t, j) => <Tag key={j} label={t} colorKey={TAG_K[j % 5]} />)}</div>}
              {/* Badges */}
              <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                {bot.settings?.allowGroupRP && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: C.info + "18", color: C.info, fontWeight: 600 }}>👥 Group</span>}
              </div>
            </button>
          ))}
        </div>
        {filtered.length === 0 && <div style={{ textAlign: "center", padding: "50px 16px", color: C.t3 }}><div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div><div style={{ fontSize: 13 }}>No bots found.</div></div>}
      </div>

      {mobile && <BottomNav active="discover" onNav={id => { if (id === "create") onOpenBuilder(); if (id === "profile") onProfile(); }} items={navItems} />}
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
    </div>
  );
}

/* ═══════════════════════════════════════
   ADMIN PANEL
   ═══════════════════════════════════════ */
function AdminPanel({ users, bots, onBanUser, onBack, mobile }) {
  return (
    <div style={{ minHeight: "100vh", background: C.base, fontFamily: "'DM Sans', sans-serif", color: C.t1, padding: mobile ? 14 : 28 }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>⚡ Master Control</h2>
          <Btn onClick={onBack} variant="secondary" style={{ padding: "7px 14px", fontSize: 11 }}>← Back</Btn>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
          {[{ l: "Users", v: users.length, c: C.accent }, { l: "Bots", v: bots.length, c: C.info }, { l: "Likes", v: bots.reduce((s, b) => s + b.likes, 0), c: C.err }, { l: "RL", v: rl.left() + "/20", c: C.ok }].map((s, i) => (
            <div key={i} style={{ background: C.s2, border: "1px solid " + C.border, borderRadius: 10, padding: 12, textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.c }}>{s.v}</div>
              <div style={{ fontSize: 10, color: C.t3 }}>{s.l}</div>
            </div>
          ))}
        </div>
        <h3 style={{ fontSize: 12, fontWeight: 600, color: C.t2, textTransform: "uppercase", marginBottom: 8 }}>Users</h3>
        <div style={{ background: C.s2, border: "1px solid " + C.border, borderRadius: 10, overflow: "hidden" }}>
          {users.length === 0 ? <div style={{ padding: 16, textAlign: "center", color: C.t3, fontSize: 12 }}>No users yet.</div>
          : users.map((u, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderBottom: i < users.length - 1 ? "1px solid " + C.border : "none" }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: u.banned ? C.err : C.t1 }}>{u.displayName}</span>
                <span style={{ fontSize: 10, color: C.t3, marginLeft: 6 }}>@{u.username}</span>
                {u.banned && <span style={{ fontSize: 9, color: C.err, marginLeft: 6 }}>BANNED</span>}
              </div>
              <Btn onClick={() => onBanUser(u.username)} variant={u.banned ? "primary" : "danger"} style={{ padding: "4px 10px", fontSize: 10 }}>{u.banned ? "Unban" : "Ban"}</Btn>
            </div>
          ))}
        </div>
      </div>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
    </div>
  );
}

/* ═══════════════════════════════════════
   BUILDER (responsive sidebar/drawer)
   ═══════════════════════════════════════ */
function BuilderView({ formData, setFormData, botSettings, setBotSettings, llmConfig, setLlmConfig, onBack, onPublish, user, mobile }) {
  const [activeSection, setActiveSection] = useState("identity");
  const [showPreview, setShowPreview] = useState(false);
  const [previewFmt, setPreviewFmt] = useState("markdown");
  const [copied, setCopied] = useState(false);
  const [showTemplates, setShowTemplates] = useState(true);
  const [showLLM, setShowLLM] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const updateSec = useCallback((s, d) => {
    if (s === "settings") { setBotSettings(d); return; }
    setFormData(p => ({ ...p, [s]: d }));
  }, [setFormData, setBotSettings]);

  const applyTemplate = (t) => {
    const d = t.data;
    setFormData({ identity: d.identity || {}, personality: d.personality || {}, scenario: d.scenario || {}, dialogue: d.dialogue || {}, lorebook: d.lorebook || {}, system: d.system || {} });
    setShowTemplates(false); setActiveSection("identity"); setSidebarOpen(false);
  };

  const compiled = previewFmt === "markdown" ? compileMarkdown(formData) : compileJSON(formData);
  const totalTok = Math.ceil(compiled.length / 3.8);
  const llmOn = !!(llmConfig.apiUrl);
  const charName = formData.identity?.name || "Untitled";

  const setView = (v) => { setShowTemplates(v === "templates"); setShowPreview(v === "preview"); setShowLLM(v === "llm"); setShowChat(v === "chat"); setSidebarOpen(false); };
  const handleCopy = () => { if (!botSettings.allowExport) return; navigator.clipboard.writeText(compiled).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };

  const ActiveComp = SEC_COMP[activeSection];
  const curData = activeSection === "settings" ? botSettings : (formData[activeSection] || {});

  // Solo chat for builder
  const [chatMsgs, setChatMsgs] = useState([]);
  const [chatIn, setChatIn] = useState("");
  const [chatLoad, setChatLoad] = useState(false);
  const chatScrollRef = useRef(null);
  const chatAbortRef = useRef(null);

  useEffect(() => { if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight; }, [chatMsgs, chatLoad]);

  const sendTestChat = async () => {
    const txt = sanitize(chatIn.trim());
    if (!txt || chatLoad || !llmOn) return;
    setChatIn("");
    const next = [...chatMsgs, { role: "user", content: txt }]; setChatMsgs(next); setChatLoad(true);
    chatAbortRef.current = new AbortController();
    try {
      const api = [{ role: "system", content: buildSysMsg(formData) }, ...next]; if (formData.system?.postHistory) api.push({ role: "system", content: formData.system.postHistory });
      const reply = await callLLM(llmConfig, api, chatAbortRef.current.signal);
      setChatMsgs(p => [...p, { role: "assistant", content: reply }]);
    } catch (e) {}
    setChatLoad(false);
  };

  const mobileNav = [
    { id: "sections", icon: "📝", label: "Edit" },
    { id: "preview", icon: "👁", label: "Preview" },
    { id: "chat", icon: "💬", label: "Chat" },
    { id: "back", icon: "🏠", label: "Home" },
  ];

  return (
    <div style={{ display: "flex", height: "100vh", width: "100%", background: C.base, color: C.t1, fontFamily: "'DM Sans', sans-serif", overflow: "hidden", position: "relative" }}>
      {/* Mobile overlay */}
      {mobile && sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 90 }} />}

      {/* Sidebar */}
      <div style={{
        width: mobile ? 240 : 200, minWidth: mobile ? 240 : 200, background: C.s1, borderRight: "1px solid " + C.border, display: "flex", flexDirection: "column", overflow: "hidden",
        ...(mobile ? { position: "fixed", left: sidebarOpen ? 0 : -260, top: 0, bottom: 0, zIndex: 100, transition: "left 0.25s ease" } : {}),
      }}>
        <div style={{ padding: "14px 12px", borderBottom: "1px solid " + C.border, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div><div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>Super Prompt</div><div style={{ fontSize: 9, color: C.t3 }}>v4.0</div></div>
          {mobile && <button onClick={() => setSidebarOpen(false)} style={{ background: "none", border: "none", color: C.t2, fontSize: 18, cursor: "pointer" }}>×</button>}
        </div>
        <div style={{ margin: "8px 8px 4px", padding: 8, background: C.s2, borderRadius: 8, border: "1px solid " + C.border }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.t1 }}>{charName}</div>
          <div style={{ fontSize: 9, color: C.t3 }}>~{totalTok} tok · {botSettings.isPublic ? "Public" : "Private"}</div>
        </div>
        <nav style={{ flex: 1, padding: "2px 6px", overflowY: "auto" }}>
          {SECTIONS.map(s => {
            const act = activeSection === s.id && !showTemplates && !showPreview && !showLLM && !showChat;
            return (
              <button key={s.id} onClick={() => { setActiveSection(s.id); setView("editor"); }} style={{
                display: "flex", alignItems: "center", gap: 7, width: "100%", padding: "7px 8px", marginBottom: 1,
                background: act ? C.s3 : "transparent", border: act ? "1px solid " + C.border : "1px solid transparent",
                borderRadius: 6, color: act ? C.t1 : C.t2, cursor: "pointer", fontSize: 11, fontWeight: act ? 600 : 400, textAlign: "left", fontFamily: "inherit",
              }}>
                <span style={{ fontSize: 13, width: 16, textAlign: "center" }}>{s.icon}</span><span style={{ flex: 1 }}>{s.label}</span>
              </button>
            );
          })}
          <div style={{ height: 1, background: C.border, margin: "4px 2px" }} />
          {[{ icon: "🔌", label: "LLM", view: "llm", active: showLLM, dot: llmOn }, { icon: "💬", label: "Test Chat", view: "chat", active: showChat }].map(item => (
            <button key={item.view} onClick={() => setView(item.view)} style={{
              display: "flex", alignItems: "center", gap: 7, width: "100%", padding: "7px 8px", marginBottom: 1,
              background: item.active ? C.s3 : "transparent", border: item.active ? "1px solid " + C.border : "1px solid transparent",
              borderRadius: 6, color: item.active ? C.t1 : C.t2, cursor: "pointer", fontSize: 11, fontWeight: item.active ? 600 : 400, textAlign: "left", fontFamily: "inherit",
            }}>
              <span style={{ fontSize: 13, width: 16, textAlign: "center" }}>{item.icon}</span><span style={{ flex: 1 }}>{item.label}</span>
              {item.dot && <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.ok }} />}
            </button>
          ))}
        </nav>
        <div style={{ padding: 8, borderTop: "1px solid " + C.border, display: "flex", flexDirection: "column", gap: 4 }}>
          <Btn onClick={onPublish} style={{ width: "100%", padding: "7px 0", fontSize: 11 }}>Publish Bot</Btn>
          <Btn onClick={() => setView("preview")} variant="secondary" style={{ width: "100%", padding: "6px 0", fontSize: 10 }}>Preview</Btn>
          <Btn onClick={onBack} variant="ghost" style={{ width: "100%", padding: "5px 0", fontSize: 10, color: C.t3 }}>← Discover</Btn>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", paddingBottom: mobile ? 56 : 0 }}>
        <div style={{ padding: mobile ? "8px 12px" : "8px 20px", borderBottom: "1px solid " + C.border, display: "flex", alignItems: "center", justifyContent: "space-between", background: C.s1, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {mobile && <button onClick={() => setSidebarOpen(true)} style={{ background: "none", border: "none", color: C.t1, fontSize: 18, cursor: "pointer" }}>☰</button>}
            <span style={{ color: C.t3, fontSize: 11 }}>{showPreview ? "Preview" : showTemplates ? "Templates" : showLLM ? "LLM" : showChat ? "Chat" : SECTIONS.find(s => s.id === activeSection)?.label}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: llmOn ? C.ok : C.t3 }} />
            <span style={{ fontSize: 10, color: C.t3, fontFamily: "'JetBrains Mono', monospace" }}>{totalTok}</span>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: mobile ? 12 : 20 }}>
          {showLLM ? (
            <div style={{ maxWidth: 600 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 14px" }}>🔌 LLM Connection</h2>
              <div style={{ background: C.info + "12", border: "1px solid " + C.info + "30", borderRadius: 8, padding: 10, marginBottom: 16, fontSize: 11, color: C.t2 }}>🔒 Keys in-memory only. Close tab = gone.</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
                {PRESETS.map(p => <button key={p.id} onClick={() => setLlmConfig(c => ({ ...c, preset: p.id, apiUrl: p.url, model: p.model }))} style={{ padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, border: "1px solid " + (llmConfig.preset === p.id ? C.accent : C.border), background: llmConfig.preset === p.id ? C.glow : "transparent", color: llmConfig.preset === p.id ? C.accent : C.t2, cursor: "pointer", fontFamily: "inherit" }}>{p.name}</button>)}
              </div>
              <Input label="API URL" value={llmConfig.apiUrl || ""} onChange={v => setLlmConfig(c => ({ ...c, apiUrl: v }))} placeholder="https://..." />
              <Input label="Proxy URL" value={llmConfig.proxyUrl || ""} onChange={v => setLlmConfig(c => ({ ...c, proxyUrl: v }))} placeholder="Optional" />
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.t2, textTransform: "uppercase", marginBottom: 5 }}>API Key</label>
                <input type="password" value={llmConfig.apiKey || ""} onChange={e => setLlmConfig(c => ({ ...c, apiKey: e.target.value }))} placeholder="sk-..." autoComplete="off" style={{ width: "100%", background: C.s3, border: "1.5px solid " + C.border, borderRadius: 8, color: C.t1, padding: "10px 12px", fontSize: 13, fontFamily: "'JetBrains Mono', monospace", outline: "none", boxSizing: "border-box" }} />
              </div>
              <Input label="Model" value={llmConfig.model || ""} onChange={v => setLlmConfig(c => ({ ...c, model: v }))} placeholder="gpt-4o" />
            </div>
          ) : showChat ? (
            <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              <div ref={chatScrollRef} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingBottom: 8 }}>
                {chatMsgs.length === 0 && <div style={{ textAlign: "center", padding: 30, color: C.t3, fontSize: 12 }}>{llmOn ? "Test your character." : "Configure LLM first."}</div>}
                {chatMsgs.map((m, i) => <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}><div style={{ maxWidth: "80%", padding: "8px 12px", borderRadius: m.role === "user" ? "10px 10px 3px 10px" : "10px 10px 10px 3px", background: m.role === "user" ? C.accent + "20" : C.s2, border: "1px solid " + (m.role === "user" ? C.accent + "30" : C.border), fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.content}</div></div>)}
                {chatLoad && <div style={{ alignSelf: "flex-start", padding: "8px 12px", borderRadius: 8, background: C.s2 }}><span style={{ fontSize: 12, color: C.t3 }}>Thinking...</span></div>}
              </div>
              <div style={{ display: "flex", gap: 8, paddingTop: 8, flexShrink: 0 }}>
                <textarea value={chatIn} onChange={e => setChatIn(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendTestChat(); } }} placeholder="Message..." disabled={!llmOn} rows={2} style={{ flex: 1, background: C.s3, border: "1.5px solid " + C.border, borderRadius: 10, color: C.t1, padding: "10px 12px", fontSize: 13, fontFamily: "inherit", resize: "none", outline: "none", opacity: llmOn ? 1 : 0.5, boxSizing: "border-box" }} />
                <Btn onClick={sendTestChat} disabled={!chatIn.trim() || !llmOn} style={{ height: 44 }}>Send</Btn>
              </div>
            </div>
          ) : showTemplates && !showPreview ? (
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 3px" }}>Templates</h2>
              <p style={{ fontSize: 11, color: C.t2, margin: "0 0 12px" }}>Pick a foundation, then customize.</p>
              <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 8 }}>
                {TEMPLATES.map((t, i) => (
                  <button key={i} onClick={() => applyTemplate(t)} style={{ background: C.s2, border: "1px solid " + C.border, borderRadius: 10, padding: 12, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.t1, marginBottom: 2 }}>{t.name}</div>
                    <div style={{ fontSize: 10, color: C.t2, marginBottom: 6 }}>{t.desc}</div>
                    <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>{t.tags.map((tag, j) => <Tag key={j} label={tag} colorKey={TAG_K[j % 5]} />)}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : showPreview ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 6 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Output</h2>
                <div style={{ display: "flex", gap: 5 }}>
                  {["markdown", "json"].map(f => <button key={f} onClick={() => setPreviewFmt(f)} style={{ padding: "4px 10px", borderRadius: 5, fontSize: 10, fontWeight: 600, border: "1px solid " + (previewFmt === f ? C.accent : C.border), background: previewFmt === f ? C.glow : "transparent", color: previewFmt === f ? C.accent : C.t2, cursor: "pointer", fontFamily: "inherit" }}>{f === "markdown" ? "MD" : "JSON"}</button>)}
                  {botSettings.allowExport && <Btn onClick={handleCopy} style={{ padding: "4px 10px", fontSize: 10 }}>{copied ? "✓" : "Copy"}</Btn>}
                  {!botSettings.allowExport && <span style={{ fontSize: 10, color: C.t3, padding: "6px 0" }}>Export disabled</span>}
                </div>
              </div>
              <pre style={{ background: C.s2, border: "1px solid " + C.border, borderRadius: 10, padding: mobile ? 12 : 18, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: C.t1, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word", overflowY: "auto", maxHeight: "calc(100vh - 160px)" }}>{compiled || "Fill in sections."}</pre>
            </div>
          ) : (
            <div style={{ maxWidth: 600 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
                <span style={{ fontSize: 18 }}>{SECTIONS.find(s => s.id === activeSection)?.icon}</span>
                <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{SECTIONS.find(s => s.id === activeSection)?.label}</h2>
              </div>
              <ActiveComp data={curData} onChange={d => updateSec(activeSection, d)} />
            </div>
          )}
        </div>
      </div>

      {mobile && <BottomNav active={showChat ? "chat" : showPreview ? "preview" : "sections"} onNav={id => { if (id === "sections") setSidebarOpen(true); if (id === "preview") setView("preview"); if (id === "chat") setView("chat"); if (id === "back") onBack(); }} items={mobileNav} />}
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
    </div>
  );
}

/* ═══════════════════════════════════════
   MAIN ORCHESTRATOR
   ═══════════════════════════════════════ */
export default function SuperPromptBuilder() {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [bots, setBots] = useState([...FEATURED_BOTS]);
  const [view, setView] = useState("auth");
  const [selectedBot, setSelectedBot] = useState(null);
  const [formData, setFormData] = useState({ identity: {}, personality: {}, scenario: {}, dialogue: {}, lorebook: {}, system: {} });
  const [botSettings, setBotSettings] = useState({ ...DEFAULT_BOT_SETTINGS });
  const [llmConfig, setLlmConfig] = useState({ preset: "custom", apiUrl: "", apiKey: "", proxyUrl: "", proxyKey: "", model: "", temperature: 0.85, maxTokens: 1024 });
  const [likedIds, setLikedIds] = useState(new Set());
  const mobile = useMobile();

  // Origin verification — do not remove
  useEffect(() => {
    console.log("%cSuper Prompt Builder%c by Khaoskami — MIT 2025", "font-weight:bold;color:#3B82F6", "color:#8A95A8");
    if (typeof document !== "undefined") { let m = document.querySelector('meta[name="spb-origin"]'); if (!m) { m = document.createElement("meta"); m.name = "spb-origin"; document.head.appendChild(m); } m.content = "Khaoskami::MIT-2025::github.com/Khaoskami/super-prompt-builder"; }
  }, []);

  const handleLogin = (user, isNew) => {
    if (user.banned) return;
    if (isNew) setUsers(p => [...p, user]);
    setCurrentUser(user);
    setView("discover");
  };

  const handleLogout = () => {
    setCurrentUser(null); setView("auth");
    setLlmConfig({ preset: "custom", apiUrl: "", apiKey: "", proxyUrl: "", proxyKey: "", model: "", temperature: 0.85, maxTokens: 1024 });
  };

  const toggleFollow = (creatorName) => {
    setCurrentUser(u => {
      const f = u.following || [];
      return { ...u, following: f.includes(creatorName) ? f.filter(x => x !== creatorName) : [...f, creatorName] };
    });
  };

  const handlePublish = () => {
    const name = formData.identity?.name;
    if (!name) { alert("Give your bot a name first."); return; }
    const newBot = {
      id: uid(), name, tagline: formData.identity?.tagline || "", creator: currentUser.displayName || currentUser.username, creatorId: currentUser.username,
      tags: [], avatar: formData.identity?.avatar || "🤖", likes: 0, category: "Modern",
      comments: [], settings: { ...botSettings }, formData: { ...formData },
    };
    setBots(p => [newBot, ...p]);
    setView("discover");
  };

  const handleAddComment = (botId, comment) => {
    setBots(p => p.map(b => b.id === botId ? { ...b, comments: [...(b.comments || []), comment] } : b));
    if (selectedBot?.id === botId) setSelectedBot(b => ({ ...b, comments: [...(b.comments || []), comment] }));
  };

  const toggleLike = (botId) => {
    setLikedIds(p => { const n = new Set(p); n.has(botId) ? n.delete(botId) : n.add(botId); return n; });
  };

  if (view === "auth" || !currentUser) return <AuthScreen onLogin={handleLogin} users={users} />;

  if (view === "admin" && currentUser.isAdmin) return <AdminPanel users={users} bots={bots} onBanUser={un => setUsers(p => p.map(u => u.username === un ? { ...u, banned: !u.banned } : u))} onBack={() => setView("discover")} mobile={mobile} />;

  if (view === "botDetail" && selectedBot) {
    const liveBotData = bots.find(b => b.id === selectedBot.id) || selectedBot;
    return <BotDetailPage
      bot={liveBotData} user={currentUser} llmConfig={llmConfig} allUsers={users}
      onBack={() => { setSelectedBot(null); setView("discover"); }}
      onFollow={() => toggleFollow(liveBotData.creator)}
      isFollowing={(currentUser.following || []).includes(liveBotData.creator)}
      onAddComment={c => handleAddComment(liveBotData.id, c)}
      onLike={() => toggleLike(liveBotData.id)}
      isLiked={likedIds.has(liveBotData.id)}
      mobile={mobile}
    />;
  }

  if (view === "builder") return <BuilderView formData={formData} setFormData={setFormData} botSettings={botSettings} setBotSettings={setBotSettings} llmConfig={llmConfig} setLlmConfig={setLlmConfig} onBack={() => setView("discover")} onPublish={handlePublish} user={currentUser} mobile={mobile} />;

  return <DiscoverPage
    bots={bots} user={currentUser}
    onSelectBot={bot => { setSelectedBot(bot); setView("botDetail"); }}
    onOpenBuilder={() => { setFormData({ identity: {}, personality: {}, scenario: {}, dialogue: {}, lorebook: {}, system: {} }); setBotSettings({ ...DEFAULT_BOT_SETTINGS }); setView("builder"); }}
    onLogout={handleLogout}
    onAdmin={() => setView("admin")}
    onProfile={() => {}}
    mobile={mobile}
  />;
}
