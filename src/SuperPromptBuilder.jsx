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

/* ── DESIGN TOKENS ── */
const C = {
  base: "#0B0E14", s1: "#111620", s2: "#1A2030", s3: "#232D40",
  border: "#2A3548", t1: "#E8ECF2", t2: "#8A95A8", t3: "#5A6478",
  acc: "#3B82F6", accH: "#60A5FA", accG: "rgba(59,130,246,0.15)",
  ok: "#22C55E", warn: "#F59E0B", err: "#EF4444", info: "#8B5CF6",
  tags: { rose: "#FB7185", teal: "#2DD4BF", sky: "#38BDF8", amber: "#FBBF24", indigo: "#818CF8" },
};
const TAG_COLORS = ["rose", "teal", "sky", "amber", "indigo"];
const FONT = "'DM Sans', 'Helvetica Neue', sans-serif";
const MONO = "'JetBrains Mono', monospace";

/* ── MOBILE DETECTION ── */
function useIsMobile() {
  const [m, setM] = useState(window.innerWidth < 768);
  useEffect(() => {
    const h = () => setM(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return m;
}

/* ── SECURITY UTILITIES ── */
/* @provenance base64:S2hhb3NrYW1pIDo6IFN1cGVyIFByb21wdCBCdWlsZGVyIDo6IE1JVCAyMDI1 */
const _SPB_ORIGIN = { a: "Khaoskami", r: "github.com/Khaoskami/super-prompt-builder", l: "MIT", y: 2025 };
const ADMIN_USER = "Khaos_Kami";
const ADMIN_HASH = "7ca1050d7f6ff045ada2feda5dc7a4f4bac3f014deb3c316e3459424687aec11";

async function sha256(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function sanitize(s) { return typeof s === "string" ? s.replace(/<[^>]*>/g, "").slice(0, 50000) : ""; }
function maskKey(k) { return (!k || k.length < 8) ? "••••••••" : k.slice(0, 4) + "••••••••" + k.slice(-4); }
function validUrl(u) { try { const p = new URL(u); return p.protocol === "https:" || p.protocol === "http:"; } catch { return false; } }

function createRateLimiter(max, ms) {
  let ts = [];
  return {
    ok() { const n = Date.now(); ts = ts.filter(t => n - t < ms); return ts.length < max; },
    rec() { ts.push(Date.now()); },
    rem() { const n = Date.now(); ts = ts.filter(t => n - t < ms); return Math.max(0, max - ts.length); }
  };
}
const rl = createRateLimiter(20, 60000);

async function callLLM(cfg, msgs, sig) {
  if (!cfg.apiUrl || !validUrl(cfg.apiUrl)) throw new Error("Invalid API URL");
  if (!rl.ok()) throw new Error("Rate limit — wait a moment");
  rl.rec();
  const h = { "Content-Type": "application/json" };
  if (cfg.apiKey) h["Authorization"] = "Bearer " + cfg.apiKey;
  if (cfg.proxyKey) h["X-Proxy-Key"] = cfg.proxyKey;
  if (cfg.apiUrl.includes("openrouter.ai")) { h["HTTP-Referer"] = location.origin; h["X-Title"] = "Super Prompt Builder"; }
  const body = { model: cfg.model || "gpt-4o", messages: msgs, temperature: cfg.temp ?? 0.85, max_tokens: cfg.maxTok ?? 1024, stream: false };
  const url = cfg.proxyUrl || cfg.apiUrl;
  const res = await fetch(url, { method: "POST", headers: h, body: JSON.stringify(cfg.proxyUrl ? { ...body, target_url: cfg.apiUrl } : body), signal: sig });
  if (!res.ok) { const e = await res.text().catch(() => ""); throw new Error("API " + res.status + ": " + e.slice(0, 200)); }
  const d = await res.json();
  if (d.choices?.[0]?.message?.content) return d.choices[0].message.content;
  if (d.content?.[0]?.text) return d.content[0].text;
  if (d.results?.[0]?.text) return d.results[0].text;
  throw new Error("Unknown API response format");
}

/* ── LLM PRESETS ── */
const PRESETS = [
  { id: "custom", name: "Custom", url: "", model: "" },
  { id: "openai", name: "OpenAI", url: "https://api.openai.com/v1/chat/completions", model: "gpt-4o" },
  { id: "openrouter", name: "OpenRouter", url: "https://openrouter.ai/api/v1/chat/completions", model: "openai/gpt-4o" },
  { id: "together", name: "Together", url: "https://api.together.xyz/v1/chat/completions", model: "meta-llama/Llama-3-70b-chat-hf" },
  { id: "ollama", name: "Ollama", url: "http://localhost:11434/v1/chat/completions", model: "llama3" },
  { id: "lmstudio", name: "LM Studio", url: "http://localhost:1234/v1/chat/completions", model: "local-model" },
  { id: "kobold", name: "KoboldCPP", url: "http://localhost:5001/v1/chat/completions", model: "kobold" },
];

/* ── BUILDER SECTIONS ── */
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
    identity: { name: "", tagline: "A tale of whispered alliances and forbidden desire" },
    personality: { traits: "Cunning, graceful, perceptive, guarded", speech: "Formal with subtle barbs, poetic when alone", quirks: "Fidgets with a ring when lying." },
    scenario: { setting: "A gilded court where every smile conceals a blade.", role: "{{user}} is a newly appointed advisor to the crown.", goal: "Navigate court politics and uncover a conspiracy." },
    system: { rules: "Never break character. Romance is slow-burn and earned." }
  }},
  { name: "Combat RPG", desc: "Mythic action & progression", tags: ["Action", "Fantasy"], data: {
    identity: { name: "", tagline: "Blood, steel, and the echoes of fallen gods" },
    personality: { traits: "Battle-hardened, dry humor, fiercely loyal", speech: "Terse in combat. Reflective in quiet moments.", quirks: "Sharpens weapons obsessively." },
    scenario: { setting: "A fractured realm where divine bloodlines grant terrible power.", role: "{{user}} carries a bloodline they don't fully understand.", goal: "Survive. Master your power. Confront the entity that killed your pantheon." },
    system: { rules: "Combat is visceral and consequential. No deus ex machina." }
  }},
  { name: "Slice of Life", desc: "Cozy emotional depth", tags: ["Comfort", "Drama"], data: {
    identity: { name: "", tagline: "Small moments that change everything" },
    personality: { traits: "Warm, observant, secretly anxious", speech: "Casual, dry observations.", quirks: "Makes tea when nervous." },
    scenario: { setting: "A coastal town where everyone knows each other's business.", role: "{{user}} has returned after years away.", goal: "Reconnect, heal, and decide whether to stay." },
    system: { rules: "Prioritize emotional realism. Pacing is slow and intentional." }
  }},
  { name: "Demon Hunter", desc: "Urban fantasy action", tags: ["Action", "Modern"], data: {
    identity: { name: "", tagline: "The veil is thin and something is pushing through" },
    personality: { traits: "Relentless, sardonic, secretly exhausted", speech: "Clipped in the field. Gentle one-on-one.", quirks: "Keeps a kill journal in shorthand." },
    scenario: { setting: "A neon-drenched city where demonic incursions are rising.", role: "{{user}} is a hunter operating outside sanctioned channels.", goal: "Track the source. Survive the night." },
    system: { rules: "Demons are genuinely dangerous. No plot armor." }
  }},
];

/* ── SAMPLE COMMUNITY BOTS ── */
const SAMPLE_BOTS = [
  { id: 1, name: "Empress Valeria", creator: "Khaos_Kami", tags: ["Otome", "Political"], tagline: "The crown is heavy. Her patience is heavier.", avatar: "V", chats: 2847, likes: 912, color: C.tags.rose },
  { id: 2, name: "Kratos (AU)", creator: "Khaos_Kami", tags: ["Combat", "Mythic"], tagline: "Boy. We are not done.", avatar: "K", chats: 4210, likes: 1583, color: C.tags.amber },
  { id: 3, name: "Nyx", creator: "shadowlore", tags: ["Horror", "Mystery"], tagline: "The dark doesn't hide monsters. It is one.", avatar: "N", chats: 1932, likes: 678, color: C.tags.indigo },
  { id: 4, name: "Captain Sable", creator: "driftwood", tags: ["Adventure", "Pirate"], tagline: "The sea takes. I take back.", avatar: "S", chats: 3104, likes: 1247, color: C.tags.teal },
  { id: 5, name: "Dr. Maren Cross", creator: "neurovex", tags: ["Sci-Fi", "Thriller"], tagline: "The cure works. The side effects are... interesting.", avatar: "M", chats: 1588, likes: 445, color: C.tags.sky },
  { id: 6, name: "Jae-woo", creator: "Khaos_Kami", tags: ["K-Pop", "Demon Hunter"], tagline: "Stage left. Kill right.", avatar: "J", chats: 5621, likes: 2890, color: C.tags.rose },
  { id: 7, name: "Wren", creator: "softglow", tags: ["Slice of Life", "Comfort"], tagline: "The kettle's on. Talk to me.", avatar: "W", chats: 987, likes: 312, color: C.tags.amber },
  { id: 8, name: "The Archivist", creator: "vaultkeeper", tags: ["Fantasy", "Lore"], tagline: "Every story is true. Most are also dangerous.", avatar: "A", chats: 2213, likes: 890, color: C.tags.indigo },
  { id: 9, name: "Riven", creator: "Khaos_Kami", tags: ["Otome", "Dark Fantasy"], tagline: "I don't break promises. I break people who do.", avatar: "R", chats: 3790, likes: 1644, color: C.tags.teal },
  { id: 10, name: "Zero", creator: "ghostpulse", tags: ["Cyberpunk", "Action"], tagline: "404: Mercy not found.", avatar: "0", chats: 1456, likes: 523, color: C.tags.sky },
  { id: 11, name: "Lady Seraphine", creator: "roseblood", tags: ["Vampire", "Romance"], tagline: "Eternity is boring without the right company.", avatar: "L", chats: 6102, likes: 3201, color: C.tags.rose },
  { id: 12, name: "Forge", creator: "ironside", tags: ["Mech", "Military"], tagline: "Suit up. We're not coming back.", avatar: "F", chats: 1890, likes: 667, color: C.tags.amber },
];

/* ── SHARED STYLES ── */
const inputBase = (focused) => ({
  width: "100%", background: C.s3, border: "1.5px solid " + (focused ? C.acc : C.border),
  borderRadius: 8, color: C.t1, padding: "10px 12px", fontSize: 13, fontFamily: "inherit",
  outline: "none", boxSizing: "border-box",
  transition: "border-color 0.2s, box-shadow 0.2s",
  boxShadow: focused ? "0 0 0 3px " + C.accG : "none",
});

/* ── SMALL COMPONENTS ── */
function TokenCounter({ text }) {
  const t = Math.ceil((text || "").length / 3.8);
  return <span style={{ fontSize: 11, color: t > 3000 ? C.err : t > 2000 ? C.warn : C.t3, fontFamily: MONO }}>~{t} tok</span>;
}

function Tag({ label, colorKey }) {
  const c = C.tags[colorKey] || C.tags.sky;
  return <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, color: c, background: c + "18", border: "1px solid " + c + "30", letterSpacing: "0.03em" }}>{label}</span>;
}

function Btn({ children, primary, danger, small, disabled, onClick, style = {} }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: small ? "6px 12px" : "10px 20px", borderRadius: 8, border: "none", fontFamily: "inherit", cursor: disabled ? "default" : "pointer",
      fontSize: small ? 12 : 13, fontWeight: 600, transition: "all 0.15s",
      background: danger ? C.err : primary ? C.acc : C.s3,
      color: (primary || danger) ? "#fff" : C.t2,
      opacity: disabled ? 0.4 : 1, ...style,
    }}>{children}</button>
  );
}

function InputField({ value, onChange, placeholder, label, type = "text", hint }) {
  const [f, setF] = useState(false);
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.t2, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>{label}</label>}
      {hint && <p style={{ fontSize: 11, color: C.t3, margin: "0 0 4px", lineHeight: 1.4 }}>{hint}</p>}
      <input type={type} value={value} onChange={e => onChange(e.target.value)} onFocus={() => setF(true)} onBlur={() => setF(false)} placeholder={placeholder} style={inputBase(f)} />
    </div>
  );
}

function TextArea({ value, onChange, placeholder, rows = 4, label, hint }) {
  const [f, setF] = useState(false);
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: C.t2, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label>
        <TokenCounter text={value} />
      </div>}
      {hint && <p style={{ fontSize: 11, color: C.t3, margin: "0 0 4px", lineHeight: 1.4 }}>{hint}</p>}
      <textarea value={value} onChange={e => onChange(e.target.value)} onFocus={() => setF(true)} onBlur={() => setF(false)} placeholder={placeholder} rows={rows}
        style={{ ...inputBase(f), fontFamily: MONO, fontSize: 13, lineHeight: 1.6, resize: "vertical" }} />
    </div>
  );
}


/* ── SECTION EDITORS ── */
function IdentitySection({ data, onChange }) {
  const u = (k, v) => onChange({ ...data, [k]: v });
  return (<div>
    <InputField label="Character Name" placeholder="e.g. Kael Voss" value={data.name || ""} onChange={v => u("name", v)} />
    <InputField label="Tagline" placeholder="A one-line hook" value={data.tagline || ""} onChange={v => u("tagline", v)} />
    <InputField label="Avatar URL" placeholder="https://..." value={data.avatar || ""} onChange={v => u("avatar", v)} />
    <TextArea label="Description" hint="Physical appearance, role, first impression." placeholder="Describe who this character is..." value={data.description || ""} onChange={v => u("description", v)} rows={4} />
  </div>);
}
function PersonalitySection({ data, onChange }) {
  const u = (k, v) => onChange({ ...data, [k]: v });
  return (<div>
    <TextArea label="Core Traits" placeholder="e.g. Cunning, empathetic, reckless" value={data.traits || ""} onChange={v => u("traits", v)} rows={2} />
    <TextArea label="Speech Pattern" placeholder="How they talk" value={data.speech || ""} onChange={v => u("speech", v)} rows={3} />
    <TextArea label="Quirks" placeholder="Behavioral details" value={data.quirks || ""} onChange={v => u("quirks", v)} rows={3} />
    <TextArea label="Backstory" placeholder="Key history" value={data.backstory || ""} onChange={v => u("backstory", v)} rows={4} />
  </div>);
}
function ScenarioSection({ data, onChange }) {
  const u = (k, v) => onChange({ ...data, [k]: v });
  return (<div>
    <TextArea label="Setting" placeholder="World, era, atmosphere..." value={data.setting || ""} onChange={v => u("setting", v)} rows={3} />
    <TextArea label="User Role" placeholder="Who {{user}} is..." value={data.role || ""} onChange={v => u("role", v)} rows={2} />
    <TextArea label="Goal / Hook" placeholder="Central tension..." value={data.goal || ""} onChange={v => u("goal", v)} rows={2} />
    <TextArea label="First Message" placeholder="Opening message..." value={data.firstMessage || ""} onChange={v => u("firstMessage", v)} rows={5} />
  </div>);
}
function DialogueSection({ data, onChange }) {
  return <TextArea label="Example Dialogue" placeholder={'{{char}}: "Line" *Action*\n{{user}}: "Response"'} value={data.examples || ""} onChange={v => onChange({ ...data, examples: v })} rows={10} />;
}
function LorebookSection({ data, onChange }) {
  const entries = data.entries || [];
  return (<div>
    <p style={{ fontSize: 11, color: C.t3, marginBottom: 12 }}>Keyword-triggered context entries.</p>
    {entries.map((e, i) => (
      <div key={e.id} style={{ background: C.s2, border: "1px solid " + C.border, borderRadius: 8, padding: 12, marginBottom: 10, position: "relative" }}>
        <button onClick={() => onChange({ ...data, entries: entries.filter((_, j) => j !== i) })} style={{ position: "absolute", top: 6, right: 8, background: "none", border: "none", color: C.t3, cursor: "pointer", fontSize: 16 }}>×</button>
        <InputField label={"Entry " + (i + 1) + " — Keywords"} placeholder="comma,separated" value={e.keyword} onChange={v => { const n = [...entries]; n[i] = { ...n[i], keyword: v }; onChange({ ...data, entries: n }); }} />
        <TextArea label="Content" placeholder="Context for these keywords..." value={e.content} onChange={v => { const n = [...entries]; n[i] = { ...n[i], content: v }; onChange({ ...data, entries: n }); }} rows={2} />
      </div>
    ))}
    <button onClick={() => onChange({ ...data, entries: [...entries, { keyword: "", content: "", id: Date.now() }] })} style={{ width: "100%", padding: 10, background: C.accG, border: "1.5px dashed " + C.acc, borderRadius: 8, color: C.acc, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>+ Add Entry</button>
  </div>);
}
function SystemSection({ data, onChange }) {
  const u = (k, v) => onChange({ ...data, [k]: v });
  return (<div>
    <TextArea label="System Rules" placeholder="Hard constraints..." value={data.rules || ""} onChange={v => u("rules", v)} rows={5} />
    <TextArea label="Author's Note" placeholder="[Style: vivid, grounded...]" value={data.authorsNote || ""} onChange={v => u("authorsNote", v)} rows={2} />
    <TextArea label="Post-History" placeholder="Appended after chat history each turn" value={data.postHistory || ""} onChange={v => u("postHistory", v)} rows={2} />
  </div>);
}
const SEC_COMP = { identity: IdentitySection, personality: PersonalitySection, scenario: ScenarioSection, dialogue: DialogueSection, lorebook: LorebookSection, system: SystemSection };


/* ── COMPILE ── */
function compilePrompt(fd) {
  const l = [], { identity: id = {}, personality: p = {}, scenario: sc = {}, dialogue: dl = {}, lorebook: lb = {}, system: sy = {} } = fd;
  if (id.name) l.push("# " + id.name);
  if (id.tagline) l.push("*" + id.tagline + "*\n");
  if (id.description) { l.push("## Description"); l.push(id.description + "\n"); }
  if (p.traits || p.speech || p.quirks || p.backstory) {
    l.push("## Personality");
    if (p.traits) l.push("**Traits:** " + p.traits);
    if (p.speech) l.push("**Speech:** " + p.speech);
    if (p.quirks) l.push("**Quirks:** " + p.quirks);
    if (p.backstory) l.push("**Backstory:** " + p.backstory);
    l.push("");
  }
  if (sc.setting || sc.role || sc.goal) {
    l.push("## Scenario");
    if (sc.setting) l.push("**Setting:** " + sc.setting);
    if (sc.role) l.push("**User Role:** " + sc.role);
    if (sc.goal) l.push("**Goal:** " + sc.goal);
    l.push("");
  }
  if (sc.firstMessage) { l.push("## First Message"); l.push(sc.firstMessage + "\n"); }
  if (dl.examples) { l.push("## Example Dialogue"); l.push(dl.examples + "\n"); }
  const ent = (lb.entries || []).filter(e => e.keyword && e.content);
  if (ent.length) { l.push("## Lorebook"); ent.forEach(e => l.push("**[" + e.keyword + "]:** " + e.content)); l.push(""); }
  if (sy.rules || sy.authorsNote || sy.postHistory) {
    l.push("## System");
    if (sy.rules) l.push("**Rules:**\n" + sy.rules);
    if (sy.authorsNote) l.push("\n**Author's Note:** " + sy.authorsNote);
    if (sy.postHistory) l.push("\n**Post-History:** " + sy.postHistory);
  }
  l.push("\n<!-- SPB::Khaoskami::github.com/Khaoskami/super-prompt-builder::MIT-2025 -->");
  return l.join("\n");
}
function compileJSON(fd) {
  const { identity: id = {}, personality: p = {}, scenario: sc = {}, dialogue: dl = {}, lorebook: lb = {}, system: sy = {} } = fd;
  return JSON.stringify({
    name: id.name || "", description: id.description || "",
    personality: [p.traits, p.speech, p.quirks, p.backstory].filter(Boolean).join("\n\n"),
    scenario: [sc.setting, sc.role && "User Role: " + sc.role, sc.goal && "Goal: " + sc.goal].filter(Boolean).join("\n\n"),
    first_mes: sc.firstMessage || "", mes_example: dl.examples || "",
    system_prompt: sy.rules || "", post_history_instructions: sy.postHistory || "",
    creator_notes: sy.authorsNote || "", tags: [],
    extensions: {
      world: (lb.entries || []).filter(e => e.keyword && e.content).map(e => ({ keys: e.keyword.split(",").map(k => k.trim()), content: e.content, enabled: true, insertion_order: 100 })),
      _spb_meta: { origin: "Khaoskami", tool: "super-prompt-builder", repo: "github.com/Khaoskami/super-prompt-builder", license: "MIT" },
    },
  }, null, 2);
}
function buildSysMsg(fd) {
  const parts = [], { identity: id = {}, personality: p = {}, scenario: sc = {}, dialogue: dl = {}, system: sy = {} } = fd;
  if (id.name) parts.push("You are " + id.name + ".");
  if (id.tagline) parts.push(id.tagline);
  if (id.description) parts.push("Description: " + id.description);
  if (p.traits) parts.push("Core traits: " + p.traits);
  if (p.speech) parts.push("Speech pattern: " + p.speech);
  if (p.quirks) parts.push("Quirks: " + p.quirks);
  if (p.backstory) parts.push("Backstory: " + p.backstory);
  if (sc.setting) parts.push("Setting: " + sc.setting);
  if (sc.role) parts.push("User's role: " + sc.role);
  if (sc.goal) parts.push("Goal: " + sc.goal);
  if (dl.examples) parts.push("Example dialogue:\n" + dl.examples);
  if (sy.rules) parts.push("RULES:\n" + sy.rules);
  if (sy.authorsNote) parts.push("[Author's Note: " + sy.authorsNote + "]");
  return parts.join("\n\n");
}


/* ═══════════════════════════════════════════════════
   PAGE: AUTH (Login / Sign Up)
   ═══════════════════════════════════════════════════ */
function AuthPage({ onLogin, isMobile }) {
  const [mode, setMode] = useState("login");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!user.trim() || !pass.trim()) { setErr("Fill in all fields"); return; }
    setLoading(true); setErr("");

    if (mode === "login") {
      const h = await sha256(pass);
      if (user.trim() === ADMIN_USER && h === ADMIN_HASH) {
        onLogin({ username: ADMIN_USER, isAdmin: true });
      } else {
        // Demo: accept any login for non-admin (in production, hit Supabase here)
        onLogin({ username: user.trim(), isAdmin: false });
      }
    } else {
      // Demo signup (in production, create Supabase user)
      if (user.trim().length < 3) { setErr("Username must be 3+ characters"); setLoading(false); return; }
      if (pass.length < 6) { setErr("Password must be 6+ characters"); setLoading(false); return; }
      onLogin({ username: user.trim(), isAdmin: false });
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: C.base, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: FONT }}>
      <div style={{ width: "100%", maxWidth: 380, background: C.s1, border: "1px solid " + C.border, borderRadius: 16, padding: isMobile ? 24 : 32 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.t1, letterSpacing: "-0.02em" }}>Super Prompt</div>
          <div style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>Builder v3.0</div>
        </div>

        <div style={{ display: "flex", gap: 0, marginBottom: 24 }}>
          {["login", "signup"].map(m => (
            <button key={m} onClick={() => { setMode(m); setErr(""); }}
              style={{ flex: 1, padding: "10px 0", background: mode === m ? C.s3 : "transparent", border: "1px solid " + (mode === m ? C.border : "transparent"), borderRadius: 8, color: mode === m ? C.t1 : C.t3, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              {m === "login" ? "Log In" : "Sign Up"}
            </button>
          ))}
        </div>

        <InputField label="Username" placeholder="Enter username" value={user} onChange={setUser} />
        <InputField label="Password" placeholder="Enter password" type="password" value={pass} onChange={setPass} />

        {err && <div style={{ color: C.err, fontSize: 12, marginBottom: 12, padding: "8px 10px", background: C.err + "12", border: "1px solid " + C.err + "30", borderRadius: 6 }}>{err}</div>}

        <Btn primary onClick={handleSubmit} disabled={loading} style={{ width: "100%", marginTop: 4 }}>
          {loading ? "..." : mode === "login" ? "Log In" : "Create Account"}
        </Btn>

        <p style={{ fontSize: 11, color: C.t3, textAlign: "center", marginTop: 16, lineHeight: 1.5 }}>
          {mode === "login" ? "Don't have an account? " : "Already have one? "}
          <span onClick={() => { setMode(mode === "login" ? "signup" : "login"); setErr(""); }} style={{ color: C.acc, cursor: "pointer" }}>
            {mode === "login" ? "Sign up" : "Log in"}
          </span>
        </p>

        <div style={{ marginTop: 20, padding: "10px 12px", background: C.info + "10", border: "1px solid " + C.info + "20", borderRadius: 8 }}>
          <p style={{ fontSize: 10, color: C.t3, lineHeight: 1.5, margin: 0 }}>
            🔒 Demo mode — credentials stored in memory only. For production auth, connect <a href="https://supabase.com" target="_blank" rel="noopener" style={{ color: C.info }}>Supabase</a>.
          </p>
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════
   PAGE: DISCOVERY (Bot For You)
   ═══════════════════════════════════════════════════ */
function DiscoveryPage({ onSelectBot, onCreateNew, user, onLogout, onAdmin, isMobile }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const cats = ["all", "Romance", "Action", "Fantasy", "Comfort", "Sci-Fi", "Horror", "Modern"];

  const filtered = SAMPLE_BOTS.filter(b => {
    if (filter !== "all" && !b.tags.some(t => t.toLowerCase().includes(filter.toLowerCase()))) return false;
    if (search && !b.name.toLowerCase().includes(search.toLowerCase()) && !b.creator.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ minHeight: "100vh", background: C.base, fontFamily: FONT }}>
      {/* Top nav */}
      <div style={{ background: C.s1, borderBottom: "1px solid " + C.border, padding: isMobile ? "12px 16px" : "12px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 800, color: C.t1 }}>Super Prompt</div>
          {!isMobile && <span style={{ fontSize: 11, color: C.t3, background: C.s3, padding: "2px 8px", borderRadius: 4 }}>v3.0</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 12 }}>
          {user.isAdmin && <Btn small onClick={onAdmin} style={{ background: C.info + "20", color: C.info, border: "1px solid " + C.info + "30" }}>Admin</Btn>}
          <Btn small primary onClick={onCreateNew}>+ Create</Btn>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, " + C.acc + ", " + C.info + ")", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>
              {user.username[0].toUpperCase()}
            </div>
            {!isMobile && <span style={{ fontSize: 12, color: C.t2 }}>{user.username}</span>}
            <button onClick={onLogout} style={{ background: "none", border: "none", color: C.t3, cursor: "pointer", fontSize: 11 }}>Logout</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: isMobile ? "20px 16px" : "32px 24px" }}>
        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: isMobile ? 24 : 36 }}>
          <h1 style={{ fontSize: isMobile ? 24 : 36, fontWeight: 800, color: C.t1, margin: "0 0 8px", letterSpacing: "-0.02em" }}>Bots For You</h1>
          <p style={{ fontSize: isMobile ? 13 : 15, color: C.t2, margin: 0 }}>Discover characters. Start conversations. Build your own.</p>
        </div>

        {/* Search */}
        <div style={{ maxWidth: 480, margin: "0 auto 20px" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search bots or creators..."
            style={{ width: "100%", background: C.s2, border: "1.5px solid " + C.border, borderRadius: 10, color: C.t1, padding: "12px 16px", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
        </div>

        {/* Category filters */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", marginBottom: isMobile ? 20 : 28 }}>
          {cats.map(c => (
            <button key={c} onClick={() => setFilter(c)} style={{
              padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer",
              border: "1px solid " + (filter === c ? C.acc : C.border),
              background: filter === c ? C.accG : "transparent",
              color: filter === c ? C.acc : C.t3, transition: "all 0.15s",
            }}>{c === "all" ? "All" : c}</button>
          ))}
        </div>

        {/* Bot grid */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(auto-fill, minmax(240px, 1fr))", gap: isMobile ? 10 : 14 }}>
          {filtered.map(bot => (
            <button key={bot.id} onClick={() => onSelectBot(bot)}
              style={{
                background: C.s1, border: "1px solid " + C.border, borderRadius: 12, padding: isMobile ? 12 : 16,
                cursor: "pointer", textAlign: "left", fontFamily: "inherit", transition: "border-color 0.2s, transform 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = bot.color; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              {/* Avatar */}
              <div style={{
                width: isMobile ? 40 : 48, height: isMobile ? 40 : 48, borderRadius: 10,
                background: "linear-gradient(135deg, " + bot.color + ", " + bot.color + "80)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: isMobile ? 16 : 20, fontWeight: 800, color: "#fff", marginBottom: 10,
              }}>{bot.avatar}</div>
              <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 700, color: C.t1, marginBottom: 2 }}>{bot.name}</div>
              <div style={{ fontSize: 11, color: C.t3, marginBottom: 6 }}>by {bot.creator}</div>
              <div style={{ fontSize: isMobile ? 11 : 12, color: C.t2, lineHeight: 1.4, marginBottom: 10, minHeight: isMobile ? 28 : 34, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                {bot.tagline}
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                {bot.tags.map((t, j) => <Tag key={j} label={t} colorKey={TAG_COLORS[j % TAG_COLORS.length]} />)}
              </div>
              <div style={{ display: "flex", gap: 12, fontSize: 10, color: C.t3 }}>
                <span>💬 {bot.chats.toLocaleString()}</span>
                <span>♥ {bot.likes.toLocaleString()}</span>
              </div>
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: C.t3 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
            <p style={{ fontSize: 13 }}>No bots match your search.</p>
          </div>
        )}
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════
   PAGE: ADMIN PANEL
   ═══════════════════════════════════════════════════ */
function AdminPage({ onBack, isMobile }) {
  return (
    <div style={{ minHeight: "100vh", background: C.base, fontFamily: FONT }}>
      <div style={{ background: C.s1, borderBottom: "1px solid " + C.border, padding: isMobile ? "12px 16px" : "12px 32px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.acc, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>← Back</button>
        <span style={{ fontSize: 16, fontWeight: 700, color: C.t1 }}>Admin Panel</span>
        <span style={{ fontSize: 10, padding: "2px 8px", background: C.err + "20", color: C.err, borderRadius: 4, fontWeight: 700 }}>MASTER</span>
      </div>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: isMobile ? 16 : 32 }}>
        <div style={{ background: C.s1, border: "1px solid " + C.border, borderRadius: 12, padding: 24, marginBottom: 16 }}>
          <h3 style={{ color: C.t1, margin: "0 0 16px", fontSize: 16 }}>Platform Stats</h3>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 12 }}>
            {[{ l: "Total Bots", v: "12", c: C.acc }, { l: "Total Users", v: "1", c: C.ok }, { l: "API Calls (24h)", v: "0", c: C.warn }, { l: "Reported", v: "0", c: C.err }].map((s, i) => (
              <div key={i} style={{ background: C.s2, borderRadius: 10, padding: 16, textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: s.c }}>{s.v}</div>
                <div style={{ fontSize: 11, color: C.t3, marginTop: 4 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: C.s1, border: "1px solid " + C.border, borderRadius: 12, padding: 24, marginBottom: 16 }}>
          <h3 style={{ color: C.t1, margin: "0 0 12px", fontSize: 16 }}>Security Status</h3>
          {[
            { l: "Rate Limiting", s: "Active", ok: true },
            { l: "Input Sanitization", s: "Active", ok: true },
            { l: "Key Encryption", s: "In-Memory Only", ok: true },
            { l: "DDoS Protection", s: "Configure Cloudflare", ok: false },
            { l: "Auth Backend", s: "Connect Supabase", ok: false },
            { l: "Origin Signatures", s: "8 Layers Active", ok: true },
          ].map((r, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < 5 ? "1px solid " + C.border : "none" }}>
              <span style={{ fontSize: 13, color: C.t1 }}>{r.l}</span>
              <span style={{ fontSize: 12, color: r.ok ? C.ok : C.warn, fontWeight: 600 }}>{r.s}</span>
            </div>
          ))}
        </div>
        <div style={{ background: C.s1, border: "1px solid " + C.border, borderRadius: 12, padding: 24 }}>
          <h3 style={{ color: C.t1, margin: "0 0 12px", fontSize: 16 }}>Production Checklist</h3>
          <div style={{ fontSize: 12, color: C.t2, lineHeight: 1.8 }}>
            <div>1. <a href="https://supabase.com" target="_blank" rel="noopener" style={{ color: C.acc }}>Supabase</a> — Auth, user DB, bot storage (free tier)</div>
            <div>2. <a href="https://cloudflare.com" target="_blank" rel="noopener" style={{ color: C.acc }}>Cloudflare</a> — DDoS protection, WAF, rate limiting (free tier)</div>
            <div>3. Vercel environment variables — move API keys server-side</div>
            <div>4. Add CORS headers and CSP policy in vercel.json</div>
            <div>5. Enable Vercel Analytics for traffic monitoring</div>
          </div>
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════
   PAGE: BUILDER (with chat + LLM)
   ═══════════════════════════════════════════════════ */
function BuilderPage({ user, onBack, isMobile, initialBot }) {
  const [sec, setSec] = useState("identity");
  const [fd, setFd] = useState({ identity: {}, personality: {}, scenario: {}, dialogue: {}, lorebook: {}, system: {} });
  const [showPrev, setShowPrev] = useState(false);
  const [prevFmt, setPrevFmt] = useState("markdown");
  const [copied, setCopied] = useState(false);
  const [showTpl, setShowTpl] = useState(!initialBot);
  const [showLLM, setShowLLM] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [sideOpen, setSideOpen] = useState(!isMobile);
  const [llm, setLlm] = useState({ preset: "custom", apiUrl: "", apiKey: "", proxyUrl: "", proxyKey: "", model: "", temp: 0.85, maxTok: 1024 });

  useEffect(() => {
    if (initialBot) {
      const t = TEMPLATES.find(t => t.name.toLowerCase().includes(initialBot.tags[0]?.toLowerCase()));
      if (t) {
        const d = t.data;
        setFd({ identity: { ...d.identity, name: initialBot.name, tagline: initialBot.tagline }, personality: d.personality || {}, scenario: d.scenario || {}, dialogue: d.dialogue || {}, lorebook: d.lorebook || {}, system: d.system || {} });
        setShowTpl(false);
      }
    }
  }, [initialBot]);

  const upd = useCallback((s, d) => setFd(p => ({ ...p, [s]: d })), []);
  const compiled = prevFmt === "markdown" ? compilePrompt(fd) : compileJSON(fd);
  const tokens = Math.ceil(compiled.length / 3.8);
  const charName = fd.identity?.name || "Untitled";
  const llmOn = !!(llm.apiUrl);

  const setView = (v) => { setShowTpl(v === "tpl"); setShowPrev(v === "prev"); setShowLLM(v === "llm"); setShowChat(v === "chat"); if (isMobile) setSideOpen(false); };
  const applyTpl = (t) => { const d = t.data; setFd({ identity: d.identity || {}, personality: d.personality || {}, scenario: d.scenario || {}, dialogue: d.dialogue || {}, lorebook: d.lorebook || {}, system: d.system || {} }); setShowTpl(false); setSec("identity"); };
  const handleCopy = () => { navigator.clipboard.writeText(compiled).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };

  const Comp = SEC_COMP[sec];

  return (
    <div style={{ display: "flex", height: "100vh", width: "100%", background: C.base, color: C.t1, fontFamily: FONT, overflow: "hidden", position: "relative" }}>

      {/* Mobile hamburger */}
      {isMobile && !sideOpen && (
        <button onClick={() => setSideOpen(true)} style={{ position: "fixed", top: 12, left: 12, zIndex: 200, background: C.s2, border: "1px solid " + C.border, borderRadius: 8, padding: "8px 10px", color: C.t1, cursor: "pointer", fontSize: 18, lineHeight: 1 }}>☰</button>
      )}

      {/* Overlay */}
      {isMobile && sideOpen && (
        <div onClick={() => setSideOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 150 }} />
      )}

      {/* Sidebar */}
      <div style={{
        width: isMobile ? 260 : 210, minWidth: isMobile ? 260 : 210,
        background: C.s1, borderRight: "1px solid " + C.border,
        display: "flex", flexDirection: "column", overflow: "hidden",
        ...(isMobile ? { position: "fixed", top: 0, left: sideOpen ? 0 : -280, bottom: 0, zIndex: 160, transition: "left 0.25s ease" } : {}),
      }}>
        <div style={{ padding: "16px 14px 12px", borderBottom: "1px solid " + C.border, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>Super Prompt</div>
            <div style={{ fontSize: 10, color: C.t3, marginTop: 1 }}>Builder v3.0</div>
          </div>
          <button onClick={onBack} style={{ background: "none", border: "none", color: C.acc, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>← Home</button>
        </div>

        {/* Char card */}
        <div style={{ margin: "10px 10px 6px", padding: 10, background: C.s2, borderRadius: 8, border: "1px solid " + C.border }}>
          <div style={{ width: 32, height: 32, borderRadius: 6, background: "linear-gradient(135deg, " + C.acc + ", " + C.info + ")", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, marginBottom: 6 }}>
            {charName[0]?.toUpperCase() || "?"}
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.t1 }}>{charName}</div>
          <div style={{ fontSize: 10, color: C.t3 }}>~{tokens} tokens</div>
        </div>

        <nav style={{ flex: 1, padding: "4px 6px", overflowY: "auto" }}>
          {SECTIONS.map(s => {
            const act = sec === s.id && !showTpl && !showPrev && !showLLM && !showChat;
            const has = Object.values(fd[s.id] || {}).some(v => typeof v === "string" ? v.trim() : Array.isArray(v) ? v.length > 0 : false);
            return (
              <button key={s.id} onClick={() => { setSec(s.id); setView("edit"); }}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", marginBottom: 1, background: act ? C.s3 : "transparent", border: act ? "1px solid " + C.border : "1px solid transparent", borderRadius: 6, color: act ? C.t1 : C.t2, cursor: "pointer", fontSize: 12, fontWeight: act ? 600 : 400, textAlign: "left", fontFamily: "inherit" }}>
                <span style={{ fontSize: 14, width: 18, textAlign: "center" }}>{s.icon}</span>
                <span style={{ flex: 1 }}>{s.label}</span>
                {has && <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.ok }} />}
              </button>
            );
          })}
          <div style={{ height: 1, background: C.border, margin: "6px 4px" }} />
          <button onClick={() => setView("llm")} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", marginBottom: 1, background: showLLM ? C.s3 : "transparent", border: showLLM ? "1px solid " + C.border : "1px solid transparent", borderRadius: 6, color: showLLM ? C.t1 : C.t2, cursor: "pointer", fontSize: 12, textAlign: "left", fontFamily: "inherit" }}>
            <span style={{ fontSize: 14, width: 18, textAlign: "center" }}>🔌</span><span style={{ flex: 1 }}>LLM Config</span>
            {llmOn && <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.ok }} />}
          </button>
          <button onClick={() => setView("chat")} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", marginBottom: 1, background: showChat ? C.s3 : "transparent", border: showChat ? "1px solid " + C.border : "1px solid transparent", borderRadius: 6, color: showChat ? C.t1 : C.t2, cursor: "pointer", fontSize: 12, textAlign: "left", fontFamily: "inherit" }}>
            <span style={{ fontSize: 14, width: 18, textAlign: "center" }}>💬</span><span style={{ flex: 1 }}>Test Chat</span>
          </button>
        </nav>

        <div style={{ padding: 10, borderTop: "1px solid " + C.border, display: "flex", flexDirection: "column", gap: 4 }}>
          <Btn primary onClick={() => setView("prev")} style={{ width: "100%", padding: "8px 0", fontSize: 12 }}>Preview & Export</Btn>
          <button onClick={() => { setFd({ identity: {}, personality: {}, scenario: {}, dialogue: {}, lorebook: {}, system: {} }); setView("tpl"); }}
            style={{ padding: "7px 0", borderRadius: 6, border: "1px solid " + C.border, background: "transparent", color: C.t3, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Reset</button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top bar */}
        <div style={{ padding: isMobile ? "10px 16px 10px 52px" : "10px 20px", borderBottom: "1px solid " + C.border, display: "flex", alignItems: "center", justifyContent: "space-between", background: C.s1, minHeight: 44 }}>
          <span style={{ color: C.t3, fontSize: 11 }}>
            {showPrev ? "Preview" : showTpl ? "Templates" : showLLM ? "LLM Config" : showChat ? "Chat" : "Editing → " + (SECTIONS.find(s => s.id === sec)?.label || "")}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: llmOn ? C.ok : C.t3, display: "inline-block" }} />
            <span style={{ fontSize: 11, color: C.t3, fontFamily: MONO }}>{tokens} tok</span>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? 16 : "20px 24px" }}>
          {showLLM ? (
            <LLMPanel cfg={llm} onChange={setLlm} isMobile={isMobile} />
          ) : showChat ? (
            <ChatPanel fd={fd} llm={llm} isMobile={isMobile} />
          ) : showTpl ? (
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: C.t1, margin: "0 0 4px" }}>Templates</h2>
              <p style={{ fontSize: 12, color: C.t2, margin: "0 0 16px" }}>Pick a foundation.</p>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                {TEMPLATES.map((t, i) => (
                  <button key={i} onClick={() => applyTpl(t)} style={{ background: C.s2, border: "1px solid " + C.border, borderRadius: 10, padding: 14, cursor: "pointer", textAlign: "left", fontFamily: "inherit", transition: "border-color 0.2s" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = C.acc} onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.t1, marginBottom: 3 }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: C.t2, marginBottom: 8 }}>{t.desc}</div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {t.tags.map((tag, j) => <Tag key={j} label={tag} colorKey={TAG_COLORS[j % TAG_COLORS.length]} />)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : showPrev ? (
            <div>
              <div style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", marginBottom: 14, flexDirection: isMobile ? "column" : "row", gap: isMobile ? 10 : 0 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: C.t1, margin: 0 }}>Compiled Output</h2>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {["markdown", "json"].map(f => (
                    <button key={f} onClick={() => setPrevFmt(f)} style={{ padding: "5px 10px", borderRadius: 5, fontSize: 11, fontWeight: 600, border: "1px solid " + (prevFmt === f ? C.acc : C.border), background: prevFmt === f ? C.accG : "transparent", color: prevFmt === f ? C.acc : C.t3, cursor: "pointer", fontFamily: "inherit" }}>
                      {f === "json" ? "JSON (Tavern)" : "Markdown"}
                    </button>
                  ))}
                  <Btn small primary onClick={handleCopy}>{copied ? "Copied!" : "Copy"}</Btn>
                </div>
              </div>
              <pre style={{ background: C.s2, border: "1px solid " + C.border, borderRadius: 10, padding: isMobile ? 14 : 18, fontSize: 11, fontFamily: MONO, color: C.t1, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word", overflowY: "auto", maxHeight: "calc(100vh - 180px)" }}>
                {compiled || "Fill in sections to see output."}
              </pre>
            </div>
          ) : (
            <div style={{ maxWidth: 600 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <span style={{ fontSize: 20 }}>{SECTIONS.find(s => s.id === sec)?.icon}</span>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: C.t1, margin: 0 }}>{SECTIONS.find(s => s.id === sec)?.label}</h2>
              </div>
              <Comp data={fd[sec] || {}} onChange={d => upd(sec, d)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


/* ── LLM SETTINGS SUB-PANEL ── */
function LLMPanel({ cfg, onChange, isMobile }) {
  const [showK, setShowK] = useState(false);
  const [showPK, setShowPK] = useState(false);
  const [test, setTest] = useState(null);
  const [testing, setTesting] = useState(false);
  const u = (k, v) => onChange({ ...cfg, [k]: v });
  const applyP = (id) => { const p = PRESETS.find(x => x.id === id); if (p) onChange({ ...cfg, preset: id, apiUrl: p.url, model: p.model }); };

  const doTest = async () => {
    setTesting(true); setTest(null);
    try { await callLLM(cfg, [{ role: "user", content: "Reply: OK" }]); setTest({ ok: true }); }
    catch (e) { setTest({ ok: false, msg: e.message }); }
    setTesting(false);
  };

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 20 }}>🔌</span>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: C.t1, margin: 0 }}>LLM Connection</h2>
      </div>

      <div style={{ background: C.info + "10", border: "1px solid " + C.info + "20", borderRadius: 8, padding: "8px 12px", marginBottom: 16, fontSize: 11, color: C.t2, lineHeight: 1.5 }}>
        🔒 Keys held in memory only. Never saved. Close tab = gone.
      </div>

      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 14 }}>
        {PRESETS.map(p => (
          <button key={p.id} onClick={() => applyP(p.id)} style={{
            padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, fontFamily: "inherit", cursor: "pointer",
            border: "1px solid " + (cfg.preset === p.id ? C.acc : C.border),
            background: cfg.preset === p.id ? C.accG : "transparent",
            color: cfg.preset === p.id ? C.acc : C.t3,
          }}>{p.name}</button>
        ))}
      </div>

      <InputField label="API URL" placeholder="https://..." value={cfg.apiUrl || ""} onChange={v => u("apiUrl", v)} />
      <InputField label="Proxy URL (Optional)" placeholder="https://proxy..." value={cfg.proxyUrl || ""} onChange={v => u("proxyUrl", v)} />

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.t2, textTransform: "uppercase", marginBottom: 5 }}>API Key</label>
        <div style={{ display: "flex", gap: 6 }}>
          <input type={showK ? "text" : "password"} value={cfg.apiKey || ""} onChange={e => u("apiKey", e.target.value)} placeholder="sk-..." autoComplete="off" style={{ flex: 1, ...inputBase(false), fontFamily: MONO }} />
          <button onClick={() => setShowK(!showK)} style={{ padding: "0 12px", borderRadius: 8, border: "1px solid " + C.border, background: C.s2, color: C.t2, cursor: "pointer", fontSize: 11 }}>{showK ? "Hide" : "Show"}</button>
        </div>
        {cfg.apiKey && <p style={{ fontSize: 10, color: C.t3, marginTop: 3, fontFamily: MONO }}>{maskKey(cfg.apiKey)}</p>}
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.t2, textTransform: "uppercase", marginBottom: 5 }}>Proxy Key (Optional)</label>
        <div style={{ display: "flex", gap: 6 }}>
          <input type={showPK ? "text" : "password"} value={cfg.proxyKey || ""} onChange={e => u("proxyKey", e.target.value)} placeholder="Token" autoComplete="off" style={{ flex: 1, ...inputBase(false), fontFamily: MONO }} />
          <button onClick={() => setShowPK(!showPK)} style={{ padding: "0 12px", borderRadius: 8, border: "1px solid " + C.border, background: C.s2, color: C.t2, cursor: "pointer", fontSize: 11 }}>{showPK ? "Hide" : "Show"}</button>
        </div>
      </div>

      <InputField label="Model" placeholder="gpt-4o, llama3, etc." value={cfg.model || ""} onChange={v => u("model", v)} />

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.t2, textTransform: "uppercase", marginBottom: 5 }}>Temperature</label>
          <input type="range" min="0" max="2" step="0.05" value={cfg.temp ?? 0.85} onChange={e => u("temp", parseFloat(e.target.value))} style={{ width: "100%", accentColor: C.acc }} />
          <span style={{ fontSize: 10, color: C.t3, fontFamily: MONO }}>{(cfg.temp ?? 0.85).toFixed(2)}</span>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.t2, textTransform: "uppercase", marginBottom: 5 }}>Max Tokens</label>
          <input type="number" min={64} max={8192} value={cfg.maxTok ?? 1024} onChange={e => u("maxTok", parseInt(e.target.value) || 1024)} style={{ ...inputBase(false), fontFamily: MONO }} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <Btn primary onClick={doTest} disabled={testing || !cfg.apiUrl}>{testing ? "Testing..." : "Test"}</Btn>
        <Btn danger onClick={() => onChange({ preset: "custom", apiUrl: "", apiKey: "", proxyUrl: "", proxyKey: "", model: "", temp: 0.85, maxTok: 1024 })}>Clear All</Btn>
      </div>
      {test && <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 6, background: (test.ok ? C.ok : C.err) + "15", border: "1px solid " + (test.ok ? C.ok : C.err) + "30", fontSize: 11, color: test.ok ? C.ok : C.err, fontFamily: MONO }}>{test.ok ? "✓ Connected" : "✗ " + test.msg}</div>}
    </div>
  );
}


/* ── CHAT SUB-PANEL ── */
function ChatPanel({ fd, llm, isMobile }) {
  const [msgs, setMsgs] = useState([]);
  const [inp, setInp] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const scrollRef = useRef(null);
  const abortRef = useRef(null);
  const initRef = useRef(false);
  const name = fd.identity?.name || "Character";
  const on = !!(llm.apiUrl);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [msgs, loading]);
  useEffect(() => { if (!initRef.current && fd.scenario?.firstMessage) { setMsgs([{ role: "assistant", content: fd.scenario.firstMessage }]); initRef.current = true; } }, [fd.scenario?.firstMessage]);

  const send = async () => {
    const t = sanitize(inp.trim());
    if (!t || loading || !on) return;
    setInp(""); setErr(null);
    const next = [...msgs, { role: "user", content: t }];
    setMsgs(next); setLoading(true);
    abortRef.current = new AbortController();
    try {
      const api = [{ role: "system", content: buildSysMsg(fd) }, ...next.map(m => ({ role: m.role, content: m.content }))];
      if (fd.system?.postHistory) api.push({ role: "system", content: fd.system.postHistory });
      const reply = await callLLM(llm, api, abortRef.current.signal);
      setMsgs(p => [...p, { role: "assistant", content: reply }]);
    } catch (e) { if (e.name !== "AbortError") setErr(e.message); }
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: "linear-gradient(135deg, " + C.acc + ", " + C.info + ")", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>{name[0]?.toUpperCase()}</div>
          <div><div style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>{name}</div><div style={{ fontSize: 10, color: on ? C.ok : C.t3 }}>{on ? llm.model || "connected" : "No LLM"}</div></div>
        </div>
        <button onClick={() => { setMsgs([]); initRef.current = false; if (fd.scenario?.firstMessage) { setMsgs([{ role: "assistant", content: fd.scenario.firstMessage }]); initRef.current = true; } }} style={{ background: "none", border: "1px solid " + C.border, borderRadius: 6, color: C.t3, cursor: "pointer", fontSize: 10, padding: "4px 10px", fontFamily: "inherit" }}>Clear</button>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingBottom: 10 }}>
        {msgs.length === 0 && <div style={{ textAlign: "center", padding: 40, color: C.t3 }}><div style={{ fontSize: 28, marginBottom: 8 }}>💬</div><p style={{ fontSize: 12 }}>{on ? "Start chatting." : "Configure LLM first."}</p></div>}
        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{ maxWidth: isMobile ? "90%" : "80%", padding: "8px 12px", borderRadius: m.role === "user" ? "10px 10px 3px 10px" : "10px 10px 10px 3px", background: m.role === "user" ? C.acc + "22" : C.s2, border: "1px solid " + (m.role === "user" ? C.acc + "35" : C.border), color: C.t1, fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: C.t3, marginBottom: 3, textTransform: "uppercase" }}>{m.role === "user" ? "You" : name}</div>
              {m.content}
            </div>
          </div>
        ))}
        {loading && <div style={{ padding: "8px 12px", borderRadius: "10px 10px 10px 3px", background: C.s2, border: "1px solid " + C.border, alignSelf: "flex-start", color: C.t3, fontSize: 12 }}>Thinking...</div>}
      </div>

      {err && <div style={{ padding: "6px 10px", borderRadius: 6, background: C.err + "12", border: "1px solid " + C.err + "25", fontSize: 11, color: C.err, marginBottom: 6, display: "flex", justifyContent: "space-between" }}><span>{err}</span><button onClick={() => setErr(null)} style={{ background: "none", border: "none", color: C.err, cursor: "pointer" }}>×</button></div>}

      <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
        <textarea value={inp} onChange={e => setInp(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={on ? "Message " + name + "..." : "Configure LLM"} disabled={!on} rows={2}
          style={{ flex: 1, ...inputBase(false), resize: "none", opacity: on ? 1 : 0.5 }} />
        {loading
          ? <Btn danger onClick={() => { abortRef.current?.abort(); setLoading(false); }} style={{ height: 38 }}>Stop</Btn>
          : <Btn primary onClick={send} disabled={!inp.trim() || !on} style={{ height: 38 }}>Send</Btn>
        }
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════
   ROOT APP — Routing & Auth
   ═══════════════════════════════════════════════════ */
export default function SuperPromptBuilder() {
  const [page, setPage] = useState("auth"); // auth | discover | builder | admin
  const [user, setUser] = useState(null);
  const [selectedBot, setSelectedBot] = useState(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    console.log("%cSuper Prompt Builder%c by Khaoskami — github.com/Khaoskami/super-prompt-builder — MIT 2025", "font-weight:bold;color:#3B82F6", "color:#8A95A8");
    if (typeof document !== "undefined") {
      let m = document.querySelector('meta[name="spb-origin"]');
      if (!m) { m = document.createElement("meta"); m.name = "spb-origin"; document.head.appendChild(m); }
      m.content = "Khaoskami::super-prompt-builder::MIT-2025::github.com/Khaoskami/super-prompt-builder";
    }
  }, []);

  const login = (u) => { setUser(u); setPage("discover"); };
  const logout = () => { setUser(null); setPage("auth"); };

  return (
    <div
      data-spb-author="Khaoskami"
      data-spb-repo="github.com/Khaoskami/super-prompt-builder"
      data-spb-license="MIT-2025"
    >
      <div aria-hidden="true" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden", opacity: 0, pointerEvents: "none" }}>
        Super Prompt Builder by Khaoskami. MIT 2025. github.com/Khaoskami/super-prompt-builder
      </div>

      {page === "auth" && <AuthPage onLogin={login} isMobile={isMobile} />}
      {page === "discover" && user && (
        <DiscoveryPage
          user={user}
          onSelectBot={(b) => { setSelectedBot(b); setPage("builder"); }}
          onCreateNew={() => { setSelectedBot(null); setPage("builder"); }}
          onLogout={logout}
          onAdmin={() => setPage("admin")}
          isMobile={isMobile}
        />
      )}
      {page === "builder" && user && (
        <BuilderPage
          user={user}
          onBack={() => { setSelectedBot(null); setPage("discover"); }}
          isMobile={isMobile}
          initialBot={selectedBot}
        />
      )}
      {page === "admin" && user?.isAdmin && (
        <AdminPage onBack={() => setPage("discover")} isMobile={isMobile} />
      )}

      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #0B0E14; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2A3548; border-radius: 3px; }
        ::placeholder { color: #5A6478; }
        @media (max-width: 768px) {
          ::-webkit-scrollbar { width: 3px; }
        }
      `}</style>
    </div>
  );
}
