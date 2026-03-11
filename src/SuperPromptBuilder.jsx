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
  accent: "#3B82F6", accentH: "#60A5FA", glow: "rgba(59,130,246,0.15)",
  ok: "#22C55E", warn: "#F59E0B", err: "#EF4444", info: "#8B5CF6",
  tags: { rose: "#FB7185", teal: "#2DD4BF", sky: "#38BDF8", amber: "#FBBF24", indigo: "#818CF8" },
};
const TAG_COLORS = ["rose", "teal", "sky", "amber", "indigo"];

/* ── SECURITY ── */
/* @provenance base64:S2hhb3NrYW1pIDo6IFN1cGVyIFByb21wdCBCdWlsZGVyIDo6IE1JVCAyMDI1 */
const _SPB_ORIGIN = { a: "Khaoskami", r: "github.com/Khaoskami/super-prompt-builder", l: "MIT", y: 2025 };

function _h(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i); return (h >>> 0).toString(36); }
const _MU = "1ct4um4", _MP = "xzph32"; // Admin credential hashes — NOT plaintext. See security notes.

function sanitize(s) { return typeof s === "string" ? s.replace(/<[^>]*>/g, "").slice(0, 50000) : ""; }
function maskKey(k) { return !k || k.length < 8 ? "••••••••" : k.slice(0, 4) + "••••••••" + k.slice(-4); }
function validUrl(u) { try { const p = new URL(u); return p.protocol === "https:" || p.protocol === "http:"; } catch { return false; } }

function makeRL(max, ms) {
  let ts = [];
  return {
    ok() { ts = ts.filter(t => Date.now() - t < ms); return ts.length < max; },
    hit() { ts.push(Date.now()); },
    left() { ts = ts.filter(t => Date.now() - t < ms); return Math.max(0, max - ts.length); },
  };
}
const rl = makeRL(20, 60000);

// Anti-flood: prevent rapid auth attempts
const authRL = makeRL(5, 30000);

/* ── LLM ── */
const PRESETS = [
  { id: "custom", name: "Custom", url: "", model: "", note: "Any OpenAI-compatible endpoint" },
  { id: "openai", name: "OpenAI", url: "https://api.openai.com/v1/chat/completions", model: "gpt-4o", note: "OpenAI key required" },
  { id: "openrouter", name: "OpenRouter", url: "https://openrouter.ai/api/v1/chat/completions", model: "openai/gpt-4o", note: "OpenRouter key required" },
  { id: "together", name: "Together", url: "https://api.together.xyz/v1/chat/completions", model: "meta-llama/Llama-3-70b-chat-hf", note: "Together key required" },
  { id: "ollama", name: "Ollama", url: "http://localhost:11434/v1/chat/completions", model: "llama3", note: "Local — no key" },
  { id: "lmstudio", name: "LM Studio", url: "http://localhost:1234/v1/chat/completions", model: "local-model", note: "Local — no key" },
  { id: "kobold", name: "KoboldCPP", url: "http://localhost:5001/v1/chat/completions", model: "kobold", note: "Local — no key" },
];

async function callLLM(cfg, msgs, signal) {
  if (!cfg.apiUrl) throw new Error("No API URL");
  if (!validUrl(cfg.apiUrl)) throw new Error("Invalid URL");
  if (!rl.ok()) throw new Error("Rate limited — wait");
  rl.hit();
  const hd = { "Content-Type": "application/json" };
  if (cfg.apiKey) hd["Authorization"] = "Bearer " + cfg.apiKey;
  if (cfg.proxyKey) hd["X-Proxy-Key"] = cfg.proxyKey;
  if (cfg.apiUrl.includes("openrouter")) { hd["HTTP-Referer"] = location.origin; hd["X-Title"] = "Super Prompt Builder"; }
  const body = { model: cfg.model || "gpt-4o", messages: msgs, temperature: cfg.temperature ?? 0.85, max_tokens: cfg.maxTokens ?? 1024, stream: false };
  const url = cfg.proxyUrl || cfg.apiUrl;
  const bd = cfg.proxyUrl ? { ...body, target_url: cfg.apiUrl } : body;
  const r = await fetch(url, { method: "POST", headers: hd, body: JSON.stringify(bd), signal });
  if (!r.ok) { const e = await r.text().catch(() => ""); throw new Error("API " + r.status + ": " + e.slice(0, 200)); }
  const d = await r.json();
  if (d.choices?.[0]?.message?.content) return d.choices[0].message.content;
  if (d.content?.[0]?.text) return d.content[0].text;
  if (d.results?.[0]?.text) return d.results[0].text;
  throw new Error("Unknown response format");
}

/* ── MOBILE HOOK ── */
function useMobile(bp = 768) {
  const [m, setM] = useState(typeof window !== "undefined" ? window.innerWidth < bp : false);
  useEffect(() => {
    const fn = () => setM(window.innerWidth < bp);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, [bp]);
  return m;
}

/* ── DATA STRUCTURES ── */
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
    personality: { traits: "Cunning, graceful, perceptive, guarded", speech: "Formal with subtle barbs", quirks: "Fidgets with a ring when lying." },
    scenario: { setting: "A gilded court where every smile conceals a blade.", role: "{{user}} is a newly appointed advisor to the crown.", goal: "Navigate court politics and uncover a conspiracy." },
    system: { rules: "Never break character. Romance is slow-burn and earned." }
  }},
  { name: "Combat RPG", desc: "Mythic action & progression", tags: ["Action", "Fantasy"], data: {
    identity: { name: "", tagline: "Blood, steel, and the echoes of fallen gods" },
    personality: { traits: "Battle-hardened, dry humor, fiercely loyal", speech: "Terse in combat. Reflective in quiet moments.", quirks: "Sharpens weapons obsessively." },
    scenario: { setting: "A fractured realm where divine bloodlines grant terrible power.", role: "{{user}} carries a bloodline they don't fully understand.", goal: "Survive. Master your power." },
    system: { rules: "Combat must be visceral — injuries persist. No deus ex machina." }
  }},
  { name: "Slice of Life", desc: "Cozy emotional depth", tags: ["Comfort", "Drama"], data: {
    identity: { name: "", tagline: "Small moments that change everything" },
    personality: { traits: "Warm, observant, secretly anxious", speech: "Casual, dry observations.", quirks: "Makes tea when nervous." },
    scenario: { setting: "A coastal town where everyone knows each other.", role: "{{user}} has returned after years away.", goal: "Reconnect, heal, decide to stay or leave." },
    system: { rules: "Prioritize emotional realism. Let silence do the heavy lifting." }
  }},
  { name: "Demon Hunter", desc: "Urban fantasy action", tags: ["Action", "Modern"], data: {
    identity: { name: "", tagline: "The veil is thin and something is pushing through" },
    personality: { traits: "Relentless, sardonic, secretly exhausted", speech: "Clipped in the field. Gentle one-on-one.", quirks: "Hears frequencies others can't." },
    scenario: { setting: "A neon-drenched city where demonic incursions are rising.", role: "{{user}} is a hunter following a buried lead.", goal: "Track the source. Survive the night." },
    system: { rules: "Demons are dangerous, not fodder. No plot armor." }
  }},
];

// Featured bots for discovery (pre-loaded examples)
const FEATURED_BOTS = [
  { id: "f1", name: "Lady Seraphine", tagline: "Your move, advisor.", creator: "Khaos_Kami", tags: ["Romance", "Political"], avatar: "🌹", likes: 342, category: "Otome" },
  { id: "f2", name: "Kael the Undying", tagline: "The gods are dead. I helped.", creator: "Khaos_Kami", tags: ["Action", "Fantasy"], avatar: "⚔️", likes: 518, category: "RPG" },
  { id: "f3", name: "Mira Chen", tagline: "Welcome back. Nothing's changed. Everything has.", creator: "Khaos_Kami", tags: ["Comfort", "Drama"], avatar: "🍵", likes: 267, category: "Slice of Life" },
  { id: "f4", name: "Dante Vex", tagline: "Something followed you here.", creator: "Khaos_Kami", tags: ["Action", "Horror"], avatar: "🔥", likes: 431, category: "Dark Fantasy" },
  { id: "f5", name: "Professor Hale", tagline: "Curious. Your readings are... anomalous.", creator: "Khaos_Kami", tags: ["Mystery", "Sci-Fi"], avatar: "🔬", likes: 189, category: "Sci-Fi" },
  { id: "f6", name: "Yuki Tanaka", tagline: "The stage is yours. Don't waste it.", creator: "Khaos_Kami", tags: ["Drama", "Modern"], avatar: "🎭", likes: 305, category: "Modern" },
];

const CATEGORIES = ["All", "Trending", "RPG", "Romance", "Otome", "Dark Fantasy", "Slice of Life", "Sci-Fi", "Modern", "Action"];

/* ── BASE COMPONENTS ── */

function TokenCounter({ text }) {
  const t = Math.ceil((text || "").length / 3.8);
  return <span style={{ fontSize: 11, color: t > 3000 ? C.err : t > 2000 ? C.warn : C.t3, fontFamily: "'JetBrains Mono', monospace" }}>~{t} tok</span>;
}

function Tag({ label, colorKey }) {
  const c = C.tags[colorKey] || C.tags.sky;
  return <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, color: c, background: c + "18", border: "1px solid " + c + "30" }}>{label}</span>;
}

function TextArea({ value, onChange, placeholder, rows = 4, label, hint }) {
  const [f, setF] = useState(false);
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: C.t2, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label>
        <TokenCounter text={value} />
      </div>}
      {hint && <p style={{ fontSize: 12, color: C.t3, margin: "0 0 6px 0", lineHeight: 1.4 }}>{hint}</p>}
      <textarea value={value} onChange={e => onChange(e.target.value)} onFocus={() => setF(true)} onBlur={() => setF(false)} placeholder={placeholder} rows={rows} style={{
        width: "100%", background: C.s3, border: "1.5px solid " + (f ? C.accent : C.border), borderRadius: 8, color: C.t1,
        padding: "10px 12px", fontSize: 13, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.6, resize: "vertical",
        outline: "none", transition: "border-color 0.2s", boxShadow: f ? "0 0 0 3px " + C.glow : "none", boxSizing: "border-box",
      }} />
    </div>
  );
}

function Input({ value, onChange, placeholder, label, type = "text", style: sx }) {
  const [f, setF] = useState(false);
  return (
    <div style={{ marginBottom: 16, ...sx }}>
      {label && <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.t2, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</label>}
      <input type={type} value={value} onChange={e => onChange(e.target.value)} onFocus={() => setF(true)} onBlur={() => setF(false)} placeholder={placeholder} autoComplete="off" style={{
        width: "100%", background: C.s3, border: "1.5px solid " + (f ? C.accent : C.border), borderRadius: 8, color: C.t1,
        padding: "10px 12px", fontSize: 13, fontFamily: "inherit", outline: "none", transition: "border-color 0.2s",
        boxShadow: f ? "0 0 0 3px " + C.glow : "none", boxSizing: "border-box",
      }} />
    </div>
  );
}

function Btn({ children, onClick, variant = "primary", disabled, style: sx }) {
  const styles = {
    primary: { background: C.accent, color: "#fff", border: "none" },
    secondary: { background: "transparent", color: C.t2, border: "1px solid " + C.border },
    danger: { background: C.err + "15", color: C.err, border: "1px solid " + C.err + "30" },
    success: { background: C.ok, color: "#fff", border: "none" },
    ghost: { background: "transparent", color: C.t2, border: "none" },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: disabled ? "default" : "pointer",
      fontFamily: "inherit", transition: "all 0.15s", opacity: disabled ? 0.4 : 1, ...styles[variant], ...sx,
    }}>{children}</button>
  );
}

/* ── SECTION EDITORS ── */

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
    <p style={{ fontSize: 12, color: C.t3, margin: "0 0 16px 0", lineHeight: 1.5 }}>Lorebook entries inject context when keywords appear.</p>
    {entries.map((e, i) => (
      <div key={e.id} style={{ background: C.s2, border: "1px solid " + C.border, borderRadius: 8, padding: 14, marginBottom: 12, position: "relative" }}>
        <button onClick={() => onChange({ ...data, entries: entries.filter((_, j) => j !== i) })} style={{ position: "absolute", top: 8, right: 10, background: "none", border: "none", color: C.t3, cursor: "pointer", fontSize: 16 }}>×</button>
        <Input label={"Entry " + (i + 1) + " — Keywords"} placeholder="comma,separated" value={e.keyword} onChange={v => { const n = [...entries]; n[i] = { ...n[i], keyword: v }; onChange({ ...data, entries: n }); }} />
        <TextArea label="Content" placeholder="Context for these keywords..." value={e.content} onChange={v => { const n = [...entries]; n[i] = { ...n[i], content: v }; onChange({ ...data, entries: n }); }} rows={3} />
      </div>
    ))}
    <button onClick={() => onChange({ ...data, entries: [...entries, { keyword: "", content: "", id: Date.now() }] })} style={{
      width: "100%", padding: "10px 0", background: C.glow, border: "1.5px dashed " + C.accent, borderRadius: 8, color: C.accent, cursor: "pointer", fontSize: 13, fontWeight: 600,
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

const SEC_COMP = { identity: IdentitySection, personality: PersonalitySection, scenario: ScenarioSection, dialogue: DialogueSection, lorebook: LorebookSection, system: SystemSection };

/* ── COMPILE ── */

function compileMarkdown(fd) {
  const l = [], { identity: id = {}, personality: p = {}, scenario: sc = {}, dialogue: di = {}, lorebook: lb = {}, system: sy = {} } = fd;
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
  if (di.examples) { l.push("## Example Dialogue"); l.push(di.examples + "\n"); }
  const fe = (lb.entries || []).filter(e => e.keyword && e.content);
  if (fe.length) { l.push("## Lorebook"); fe.forEach(e => l.push("**[" + e.keyword + "]:** " + e.content)); l.push(""); }
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
  const { identity: id = {}, personality: p = {}, scenario: sc = {}, dialogue: di = {}, lorebook: lb = {}, system: sy = {} } = fd;
  return JSON.stringify({
    name: id.name || "", description: id.description || "",
    personality: [p.traits, p.speech, p.quirks, p.backstory].filter(Boolean).join("\n\n"),
    scenario: [sc.setting, sc.role && "User Role: " + sc.role, sc.goal && "Goal: " + sc.goal].filter(Boolean).join("\n\n"),
    first_mes: sc.firstMessage || "", mes_example: di.examples || "",
    system_prompt: sy.rules || "", post_history_instructions: sy.postHistory || "", creator_notes: sy.authorsNote || "",
    tags: [],
    extensions: {
      world: (lb.entries || []).filter(e => e.keyword && e.content).map(e => ({ keys: e.keyword.split(",").map(k => k.trim()), content: e.content, enabled: true, insertion_order: 100 })),
      _spb_meta: { origin: "Khaoskami", tool: "super-prompt-builder", repo: "github.com/Khaoskami/super-prompt-builder", license: "MIT" },
    },
  }, null, 2);
}

function buildSysMsg(fd) {
  const pts = [], { identity: id = {}, personality: p = {}, scenario: sc = {}, dialogue: di = {}, system: sy = {} } = fd;
  if (id.name) pts.push("You are " + id.name + ".");
  if (id.tagline) pts.push(id.tagline);
  if (id.description) pts.push("Description: " + id.description);
  if (p.traits) pts.push("Core traits: " + p.traits);
  if (p.speech) pts.push("Speech: " + p.speech);
  if (p.quirks) pts.push("Quirks: " + p.quirks);
  if (p.backstory) pts.push("Backstory: " + p.backstory);
  if (sc.setting) pts.push("Setting: " + sc.setting);
  if (sc.role) pts.push("User role: " + sc.role);
  if (sc.goal) pts.push("Goal: " + sc.goal);
  if (di.examples) pts.push("Example dialogue:\n" + di.examples);
  if (sy.rules) pts.push("RULES:\n" + sy.rules);
  if (sy.authorsNote) pts.push("[Author's Note: " + sy.authorsNote + "]");
  return pts.join("\n\n");
}


/* ══════════════════════════════════════════════════════════════
   AUTH SCREEN
   ══════════════════════════════════════════════════════════════ */

function AuthScreen({ onLogin, users }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const mobile = useMobile();

  const submit = () => {
    setError("");
    const u = sanitize(username.trim());
    const p = password;
    if (!u || !p) { setError("All fields required"); return; }
    if (u.length < 3 || u.length > 24) { setError("Username: 3-24 characters"); return; }
    if (p.length < 6) { setError("Password: 6+ characters"); return; }
    if (!authRL.ok()) { setError("Too many attempts — wait 30 seconds"); return; }
    authRL.hit();

    const uHash = _h(u), pHash = _h(p);

    if (mode === "login") {
      // Master admin check
      if (uHash === _MU && pHash === _MP) {
        onLogin({ username: u, displayName: u, isAdmin: true, joined: Date.now() });
        return;
      }
      // Regular user check
      const found = users.find(x => _h(x.username) === uHash && x.pHash === pHash);
      if (!found) { setError("Invalid credentials"); return; }
      onLogin(found);
    } else {
      if (!displayName.trim()) { setError("Display name required"); return; }
      if (users.some(x => x.username.toLowerCase() === u.toLowerCase())) { setError("Username taken"); return; }
      const newUser = { username: u, displayName: sanitize(displayName.trim()), pHash, isAdmin: false, joined: Date.now(), banned: false };
      onLogin(newUser, true);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: C.base, padding: mobile ? 16 : 40,
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{
        width: "100%", maxWidth: 400, background: C.s1, borderRadius: 16,
        border: "1px solid " + C.border, padding: mobile ? 24 : 36,
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, margin: "0 auto 12px",
            background: "linear-gradient(135deg, " + C.accent + ", " + C.info + ")",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 26, fontWeight: 700, color: "#fff",
          }}>S</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.t1 }}>Super Prompt Builder</div>
          <div style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>Build. Share. Roleplay.</div>
        </div>

        {/* Toggle */}
        <div style={{ display: "flex", background: C.s2, borderRadius: 8, padding: 3, marginBottom: 24 }}>
          {["login", "signup"].map(m => (
            <button key={m} onClick={() => { setMode(m); setError(""); }} style={{
              flex: 1, padding: "8px 0", borderRadius: 6, border: "none", fontSize: 13, fontWeight: 600,
              background: mode === m ? C.s3 : "transparent", color: mode === m ? C.t1 : C.t3,
              cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
            }}>{m === "login" ? "Log In" : "Sign Up"}</button>
          ))}
        </div>

        {mode === "signup" && (
          <Input label="Display Name" placeholder="How others see you" value={displayName} onChange={setDisplayName} />
        )}
        <Input label="Username" placeholder="Your unique handle" value={username} onChange={setUsername} />
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.t2, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
            onKeyDown={e => e.key === "Enter" && submit()}
            autoComplete="new-password"
            style={{
              width: "100%", background: C.s3, border: "1.5px solid " + C.border, borderRadius: 8, color: C.t1,
              padding: "10px 12px", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
            }} />
        </div>

        {error && (
          <div style={{ padding: "8px 12px", borderRadius: 6, background: C.err + "15", border: "1px solid " + C.err + "30", fontSize: 12, color: C.err, marginBottom: 12 }}>{error}</div>
        )}

        <Btn onClick={submit} style={{ width: "100%", marginTop: 4 }}>{mode === "login" ? "Log In" : "Create Account"}</Btn>

        <p style={{ fontSize: 11, color: C.t3, textAlign: "center", marginTop: 16, lineHeight: 1.5 }}>
          By {mode === "login" ? "logging in" : "signing up"} you agree to keep things creative and respectful.
        </p>
      </div>

      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   DISCOVERY PAGE — "Bots For You"
   ══════════════════════════════════════════════════════════════ */

function DiscoverPage({ bots, user, onSelectBot, onOpenBuilder, onLogout, onAdmin, mobile }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [likedIds, setLikedIds] = useState(new Set());

  const toggleLike = (id) => {
    setLikedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const filtered = bots.filter(b => {
    const matchSearch = !search || b.name.toLowerCase().includes(search.toLowerCase()) || b.tagline.toLowerCase().includes(search.toLowerCase()) || b.creator.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "All" || category === "Trending" || b.category === category || b.tags.includes(category);
    return matchSearch && matchCat;
  }).sort((a, b) => category === "Trending" ? b.likes - a.likes : 0);

  return (
    <div style={{ minHeight: "100vh", background: C.base, fontFamily: "'DM Sans', sans-serif", color: C.t1 }}>
      {/* Header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50, background: C.s1 + "f0", backdropFilter: "blur(12px)",
        borderBottom: "1px solid " + C.border, padding: mobile ? "12px 16px" : "12px 32px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, " + C.accent + ", " + C.info + ")",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff",
            }}>S</div>
            <span style={{ fontSize: 15, fontWeight: 700, color: C.t1 }}>Super Prompt</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: mobile ? 8 : 12 }}>
            <Btn onClick={onOpenBuilder} variant="primary" style={{ padding: mobile ? "8px 12px" : "8px 20px", fontSize: 12 }}>+ Create</Btn>
            {user.isAdmin && <Btn onClick={onAdmin} variant="ghost" style={{ padding: "8px 12px", fontSize: 12 }}>⚡ Admin</Btn>}
            <button onClick={onLogout} style={{
              width: 32, height: 32, borderRadius: 8, border: "1px solid " + C.border, background: C.s2,
              color: C.t2, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
            }} title="Log out">
              <span style={{ fontSize: 12 }}>👋</span>
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: mobile ? "20px 16px" : "28px 32px" }}>
        {/* Hero */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: mobile ? 22 : 28, fontWeight: 700, color: C.t1, margin: "0 0 4px" }}>
            Welcome back, {user.displayName || user.username}
          </h1>
          <p style={{ fontSize: 14, color: C.t2, margin: 0 }}>Discover characters or build your own.</p>
        </div>

        {/* Search */}
        <div style={{ marginBottom: 20 }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search bots, creators, tags..."
            style={{
              width: "100%", background: C.s2, border: "1.5px solid " + C.border, borderRadius: 10,
              color: C.t1, padding: "12px 16px", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        {/* Categories */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 20, WebkitOverflowScrolling: "touch" }}>
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)} style={{
              padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
              border: "1px solid " + (category === cat ? C.accent : C.border),
              background: category === cat ? C.glow : "transparent",
              color: category === cat ? C.accent : C.t2,
              cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
            }}>{cat}</button>
          ))}
        </div>

        {/* Bot Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: mobile ? "repeat(2, 1fr)" : "repeat(auto-fill, minmax(240px, 1fr))",
          gap: mobile ? 10 : 14,
        }}>
          {filtered.map(bot => (
            <button key={bot.id} onClick={() => onSelectBot(bot)} style={{
              background: C.s1, border: "1px solid " + C.border, borderRadius: 12,
              padding: mobile ? 12 : 16, cursor: "pointer", textAlign: "left",
              fontFamily: "inherit", transition: "border-color 0.2s, transform 0.15s",
              display: "flex", flexDirection: "column",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = "none"; }}
            >
              {/* Avatar */}
              <div style={{
                width: mobile ? 44 : 52, height: mobile ? 44 : 52, borderRadius: 12,
                background: "linear-gradient(135deg, " + C.accent + "40, " + C.info + "40)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: mobile ? 22 : 26, marginBottom: 10,
              }}>{bot.avatar}</div>

              <div style={{ fontSize: mobile ? 13 : 14, fontWeight: 600, color: C.t1, marginBottom: 3, lineHeight: 1.3 }}>{bot.name}</div>
              <div style={{ fontSize: 11, color: C.t3, marginBottom: 8, lineHeight: 1.4, flex: 1, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{bot.tagline}</div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 10, color: C.t3 }}>@{bot.creator}</span>
                <button onClick={e => { e.stopPropagation(); toggleLike(bot.id); }} style={{
                  background: "none", border: "none", cursor: "pointer", fontSize: 12, color: likedIds.has(bot.id) ? C.err : C.t3,
                  padding: "4px 6px", display: "flex", alignItems: "center", gap: 3,
                }}>
                  {likedIds.has(bot.id) ? "❤️" : "🤍"} <span style={{ fontSize: 10 }}>{bot.likes + (likedIds.has(bot.id) ? 1 : 0)}</span>
                </button>
              </div>

              <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                {bot.tags.slice(0, 2).map((t, j) => <Tag key={j} label={t} colorKey={TAG_COLORS[j % 5]} />)}
              </div>
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: C.t3 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 14 }}>No bots match your search.</div>
          </div>
        )}
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   ADMIN PANEL
   ══════════════════════════════════════════════════════════════ */

function AdminPanel({ users, bots, onBanUser, onDeleteBot, onBack, mobile }) {
  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>⚡</span>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.t1, margin: 0 }}>Master Control</h2>
        </div>
        <Btn onClick={onBack} variant="secondary" style={{ padding: "8px 16px", fontSize: 12 }}>← Back</Btn>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 24 }}>
        {[
          { label: "Users", val: users.length, color: C.accent },
          { label: "Bots", val: bots.length, color: C.info },
          { label: "Total Likes", val: bots.reduce((s, b) => s + b.likes, 0), color: C.err },
          { label: "Rate Limit", val: rl.left() + "/20", color: C.ok },
        ].map((s, i) => (
          <div key={i} style={{ background: C.s2, border: "1px solid " + C.border, borderRadius: 10, padding: 14, textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Users */}
      <h3 style={{ fontSize: 14, fontWeight: 600, color: C.t2, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Registered Users</h3>
      <div style={{ background: C.s2, border: "1px solid " + C.border, borderRadius: 10, marginBottom: 24, overflow: "hidden" }}>
        {users.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: C.t3, fontSize: 13 }}>No registered users yet.</div>
        ) : users.map((u, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: i < users.length - 1 ? "1px solid " + C.border : "none" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: u.banned ? C.err : C.t1 }}>
                {u.displayName} {u.banned && <span style={{ fontSize: 10, color: C.err }}>(BANNED)</span>}
              </div>
              <div style={{ fontSize: 11, color: C.t3 }}>@{u.username} · Joined {new Date(u.joined).toLocaleDateString()}</div>
            </div>
            <Btn onClick={() => onBanUser(u.username)} variant={u.banned ? "success" : "danger"} style={{ padding: "5px 12px", fontSize: 11 }}>
              {u.banned ? "Unban" : "Ban"}
            </Btn>
          </div>
        ))}
      </div>

      {/* Security Info */}
      <div style={{ background: C.info + "12", border: "1px solid " + C.info + "30", borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.info, marginBottom: 6 }}>🔒 Security Status</div>
        <div style={{ fontSize: 11, color: C.t2, lineHeight: 1.6 }}>
          Client-side rate limiting: Active (20 req/min API, 5/30s auth)<br />
          Input sanitization: Active (HTML strip + 50k char limit)<br />
          Credential storage: In-memory only — zero persistence<br />
          Admin hash verification: Active<br />
          Origin signatures: 8 layers embedded<br />
          <span style={{ color: C.warn }}>⚠ For production: add Cloudflare, Supabase Auth, and server-side validation</span>
        </div>
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   LLM SETTINGS PANEL
   ══════════════════════════════════════════════════════════════ */

function LLMPanel({ config, onChange, mobile }) {
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState(null);
  const [testing, setTesting] = useState(false);
  const upd = (k, v) => onChange({ ...config, [k]: v });

  const testConn = async () => {
    setTesting(true); setTestStatus(null);
    try {
      const r = await callLLM(config, [{ role: "user", content: "Reply: OK" }]);
      setTestStatus({ ok: true, msg: "Connected" });
    } catch (e) { setTestStatus({ ok: false, msg: e.message }); }
    setTesting(false);
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <span style={{ fontSize: 22 }}>🔌</span>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: C.t1, margin: 0 }}>LLM Connection</h2>
      </div>

      <div style={{ background: C.info + "12", border: "1px solid " + C.info + "30", borderRadius: 8, padding: "10px 14px", marginBottom: 20, display: "flex", gap: 10 }}>
        <span style={{ fontSize: 14 }}>🔒</span>
        <div style={{ fontSize: 12, color: C.t2, lineHeight: 1.5 }}>
          <strong style={{ color: C.info }}>Security:</strong> Keys are in-memory only. Never saved. Close tab = gone.
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.t2, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Provider</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {PRESETS.map(p => (
            <button key={p.id} onClick={() => onChange({ ...config, preset: p.id, apiUrl: p.url, model: p.model })} style={{
              padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
              border: "1px solid " + (config.preset === p.id ? C.accent : C.border),
              background: config.preset === p.id ? C.glow : "transparent",
              color: config.preset === p.id ? C.accent : C.t2, cursor: "pointer", fontFamily: "inherit",
            }}>{p.name}</button>
          ))}
        </div>
      </div>

      <Input label="API URL" placeholder="https://..." value={config.apiUrl || ""} onChange={v => upd("apiUrl", v)} />
      <Input label="Proxy URL (Optional)" placeholder="https://proxy..." value={config.proxyUrl || ""} onChange={v => upd("proxyUrl", v)} />

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.t2, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>API Key</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input type={showKey ? "text" : "password"} value={config.apiKey || ""} onChange={e => upd("apiKey", e.target.value)} placeholder="sk-..." autoComplete="off" style={{
            flex: 1, background: C.s3, border: "1.5px solid " + C.border, borderRadius: 8, color: C.t1, padding: "10px 12px", fontSize: 13, fontFamily: "'JetBrains Mono', monospace", outline: "none", boxSizing: "border-box",
          }} />
          <Btn onClick={() => setShowKey(!showKey)} variant="secondary" style={{ padding: "0 14px" }}>{showKey ? "Hide" : "Show"}</Btn>
        </div>
        {config.apiKey && <p style={{ fontSize: 11, color: C.t3, marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>Stored: {maskKey(config.apiKey)}</p>}
      </div>

      <Input label="Model" placeholder="gpt-4o, llama3..." value={config.model || ""} onChange={v => upd("model", v)} />

      <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.t2, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Temp</label>
          <input type="range" min="0" max="2" step="0.05" value={config.temperature ?? 0.85} onChange={e => upd("temperature", parseFloat(e.target.value))} style={{ width: "100%", accentColor: C.accent }} />
          <span style={{ fontSize: 11, color: C.t3, fontFamily: "'JetBrains Mono', monospace" }}>{(config.temperature ?? 0.85).toFixed(2)}</span>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.t2, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Max Tokens</label>
          <input type="number" min={64} max={8192} value={config.maxTokens ?? 1024} onChange={e => upd("maxTokens", parseInt(e.target.value) || 1024)} style={{
            width: "100%", background: C.s3, border: "1.5px solid " + C.border, borderRadius: 8, color: C.t1, padding: "10px 12px", fontSize: 13, fontFamily: "'JetBrains Mono', monospace", outline: "none", boxSizing: "border-box",
          }} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <Btn onClick={testConn} disabled={testing || !config.apiUrl}>{testing ? "Testing..." : "Test Connection"}</Btn>
        <Btn onClick={() => onChange({ preset: "custom", apiUrl: "", apiKey: "", proxyUrl: "", proxyKey: "", model: "", temperature: 0.85, maxTokens: 1024 })} variant="danger">Clear All</Btn>
      </div>
      {testStatus && (
        <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 6, background: (testStatus.ok ? C.ok : C.err) + "15", border: "1px solid " + (testStatus.ok ? C.ok : C.err) + "30", fontSize: 12, color: testStatus.ok ? C.ok : C.err, fontFamily: "'JetBrains Mono', monospace" }}>
          {testStatus.ok ? "✓" : "✗"} {testStatus.msg}
        </div>
      )}
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   CHAT PANEL
   ══════════════════════════════════════════════════════════════ */

function ChatPanel({ formData, llmConfig, mobile }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  const abortRef = useRef(null);
  const initRef = useRef(false);

  const charName = formData.identity?.name || "Character";
  const live = !!(llmConfig.apiUrl);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, loading]);
  useEffect(() => {
    if (!initRef.current && formData.scenario?.firstMessage) {
      setMessages([{ role: "assistant", content: formData.scenario.firstMessage }]);
      initRef.current = true;
    }
  }, [formData.scenario?.firstMessage]);

  const send = async () => {
    const txt = sanitize(input.trim());
    if (!txt || loading || !live) return;
    setInput(""); setError(null);
    const next = [...messages, { role: "user", content: txt }];
    setMessages(next); setLoading(true);
    abortRef.current = new AbortController();
    try {
      const sys = buildSysMsg(formData);
      const api = [{ role: "system", content: sys }, ...next.map(m => ({ role: m.role, content: m.content }))];
      if (formData.system?.postHistory) api.push({ role: "system", content: formData.system.postHistory });
      const reply = await callLLM(llmConfig, api, abortRef.current.signal);
      setMessages(p => [...p, { role: "assistant", content: reply }]);
    } catch (e) { if (e.name !== "AbortError") setError(e.message); }
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg," + C.accent + "," + C.info + ")", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>{charName[0]?.toUpperCase() || "?"}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>{charName}</div>
            <div style={{ fontSize: 10, color: live ? C.ok : C.t3 }}>{live ? llmConfig.model || "connected" : "No LLM"}</div>
          </div>
        </div>
        <Btn onClick={() => { setMessages([]); initRef.current = false; if (formData.scenario?.firstMessage) { setMessages([{ role: "assistant", content: formData.scenario.firstMessage }]); initRef.current = true; } }} variant="secondary" style={{ padding: "5px 10px", fontSize: 11 }}>Clear</Btn>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingBottom: 10 }}>
        {messages.length === 0 && <div style={{ textAlign: "center", padding: "40px 16px", color: C.t3 }}><div style={{ fontSize: 28, marginBottom: 8 }}>💬</div><div style={{ fontSize: 13 }}>{live ? "Start chatting." : "Configure LLM first."}</div></div>}
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: mobile ? "90%" : "80%", padding: "10px 14px",
              borderRadius: m.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
              background: m.role === "user" ? C.accent + "25" : C.s2,
              border: "1px solid " + (m.role === "user" ? C.accent + "40" : C.border),
              color: C.t1, fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.t3, marginBottom: 3, textTransform: "uppercase" }}>{m.role === "user" ? "You" : charName}</div>
              {m.content}
            </div>
          </div>
        ))}
        {loading && <div style={{ padding: "10px 14px", borderRadius: "12px 12px 12px 4px", background: C.s2, border: "1px solid " + C.border, alignSelf: "flex-start" }}><span style={{ color: C.t3, fontSize: 13 }}>Thinking...</span></div>}
      </div>

      {error && <div style={{ padding: "6px 10px", borderRadius: 6, background: C.err + "15", fontSize: 11, color: C.err, marginBottom: 6 }}>{error}</div>}

      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={live ? "Message..." : "Configure LLM"} disabled={!live} rows={2} style={{
          flex: 1, background: C.s3, border: "1.5px solid " + C.border, borderRadius: 10, color: C.t1, padding: "10px 12px", fontSize: 13, fontFamily: "inherit", resize: "none", outline: "none", opacity: live ? 1 : 0.5, boxSizing: "border-box",
        }} />
        {loading
          ? <Btn onClick={() => { abortRef.current?.abort(); setLoading(false); }} variant="danger" style={{ height: 42 }}>Stop</Btn>
          : <Btn onClick={send} disabled={!input.trim() || !live} style={{ height: 42 }}>Send</Btn>
        }
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   BUILDER (with responsive sidebar)
   ══════════════════════════════════════════════════════════════ */

function BuilderView({ formData, setFormData, llmConfig, setLlmConfig, onBack, user, mobile }) {
  const [activeSection, setActiveSection] = useState("identity");
  const [showPreview, setShowPreview] = useState(false);
  const [previewFmt, setPreviewFmt] = useState("markdown");
  const [copied, setCopied] = useState(false);
  const [showTemplates, setShowTemplates] = useState(true);
  const [showLLM, setShowLLM] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(!mobile);

  const updateSec = useCallback((s, d) => setFormData(p => ({ ...p, [s]: d })), [setFormData]);
  const applyTemplate = (t) => {
    const d = t.data;
    setFormData({ identity: d.identity || {}, personality: d.personality || {}, scenario: d.scenario || {}, dialogue: d.dialogue || {}, lorebook: d.lorebook || {}, system: d.system || {} });
    setShowTemplates(false); setActiveSection("identity");
    if (mobile) setSidebarOpen(false);
  };

  const compiled = previewFmt === "markdown" ? compileMarkdown(formData) : compileJSON(formData);
  const totalTok = Math.ceil(compiled.length / 3.8);
  const llmOn = !!(llmConfig.apiUrl);
  const charName = formData.identity?.name || "Untitled";

  const setView = (v) => {
    setShowTemplates(v === "templates"); setShowPreview(v === "preview"); setShowLLM(v === "llm"); setShowChat(v === "chat");
    if (mobile) setSidebarOpen(false);
  };

  const handleCopy = () => { navigator.clipboard.writeText(compiled).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };

  const handleReset = () => {
    setFormData({ identity: {}, personality: {}, scenario: {}, dialogue: {}, lorebook: {}, system: {} });
    setShowTemplates(true); setActiveSection("identity"); setShowPreview(false); setShowChat(false); setShowLLM(false);
  };

  const ActiveComp = SEC_COMP[activeSection];
  const curLabel = showPreview ? "Preview" : showTemplates ? "Templates" : showLLM ? "LLM Config" : showChat ? "Chat" : SECTIONS.find(s => s.id === activeSection)?.label;

  // Sidebar content (shared between mobile drawer and desktop sidebar)
  const sidebarContent = (
    <>
      <div style={{ padding: "16px 14px 12px", borderBottom: "1px solid " + C.border, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>Super Prompt</div>
          <div style={{ fontSize: 10, color: C.t3 }}>Builder v3.0</div>
        </div>
        {mobile && <button onClick={() => setSidebarOpen(false)} style={{ background: "none", border: "none", color: C.t2, fontSize: 20, cursor: "pointer" }}>×</button>}
      </div>

      <div style={{ margin: "10px 10px 6px", padding: 10, background: C.s2, borderRadius: 8, border: "1px solid " + C.border }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: "linear-gradient(135deg," + C.accent + "," + C.info + ")", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, marginBottom: 6 }}>{charName[0]?.toUpperCase() || "?"}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.t1 }}>{charName}</div>
        <div style={{ fontSize: 10, color: C.t3 }}>~{totalTok} tok</div>
      </div>

      <nav style={{ flex: 1, padding: "4px 6px", overflowY: "auto" }}>
        {SECTIONS.map(s => {
          const act = activeSection === s.id && !showTemplates && !showPreview && !showLLM && !showChat;
          const has = Object.values(formData[s.id] || {}).some(v => typeof v === "string" ? v.trim() : Array.isArray(v) ? v.length > 0 : false);
          return (
            <button key={s.id} onClick={() => { setActiveSection(s.id); setView("editor"); }} style={{
              display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", marginBottom: 1,
              background: act ? C.s3 : "transparent", border: act ? "1px solid " + C.border : "1px solid transparent",
              borderRadius: 6, color: act ? C.t1 : C.t2, cursor: "pointer", fontSize: 12, fontWeight: act ? 600 : 400, textAlign: "left", fontFamily: "inherit",
            }}>
              <span style={{ fontSize: 14, width: 18, textAlign: "center" }}>{s.icon}</span>
              <span style={{ flex: 1 }}>{s.label}</span>
              {has && <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.ok }} />}
            </button>
          );
        })}
        <div style={{ height: 1, background: C.border, margin: "6px 2px" }} />
        {[
          { icon: "🔌", label: "LLM Config", view: "llm", active: showLLM, dot: llmOn },
          { icon: "💬", label: "Test Chat", view: "chat", active: showChat },
        ].map(item => (
          <button key={item.view} onClick={() => setView(item.view)} style={{
            display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", marginBottom: 1,
            background: item.active ? C.s3 : "transparent", border: item.active ? "1px solid " + C.border : "1px solid transparent",
            borderRadius: 6, color: item.active ? C.t1 : C.t2, cursor: "pointer", fontSize: 12, fontWeight: item.active ? 600 : 400, textAlign: "left", fontFamily: "inherit",
          }}>
            <span style={{ fontSize: 14, width: 18, textAlign: "center" }}>{item.icon}</span>
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.dot && <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.ok }} />}
          </button>
        ))}
      </nav>

      <div style={{ padding: 10, borderTop: "1px solid " + C.border, display: "flex", flexDirection: "column", gap: 5 }}>
        <Btn onClick={() => setView("preview")} style={{ width: "100%", padding: "8px 0", fontSize: 12 }}>Preview & Export</Btn>
        <Btn onClick={onBack} variant="secondary" style={{ width: "100%", padding: "7px 0", fontSize: 11 }}>← Discover</Btn>
        <Btn onClick={handleReset} variant="ghost" style={{ width: "100%", padding: "6px 0", fontSize: 11, color: C.t3 }}>Reset All</Btn>
      </div>
    </>
  );

  return (
    <div style={{ display: "flex", height: "100vh", width: "100%", background: C.base, color: C.t1, fontFamily: "'DM Sans', sans-serif", overflow: "hidden", position: "relative" }}>
      {/* Mobile overlay */}
      {mobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 90 }} />
      )}

      {/* Sidebar */}
      <div style={{
        width: mobile ? 240 : 210, minWidth: mobile ? 240 : 210,
        background: C.s1, borderRight: "1px solid " + C.border,
        display: "flex", flexDirection: "column", overflow: "hidden",
        ...(mobile ? { position: "fixed", left: sidebarOpen ? 0 : -260, top: 0, bottom: 0, zIndex: 100, transition: "left 0.25s ease" } : {}),
      }}>
        {sidebarContent}
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top bar */}
        <div style={{
          padding: mobile ? "10px 14px" : "10px 24px", borderBottom: "1px solid " + C.border,
          display: "flex", alignItems: "center", justifyContent: "space-between", background: C.s1,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {mobile && (
              <button onClick={() => setSidebarOpen(true)} style={{ background: "none", border: "none", color: C.t1, fontSize: 20, cursor: "pointer", padding: "4px 8px 4px 0" }}>☰</button>
            )}
            <span style={{ color: C.t3, fontSize: 12 }}>{curLabel}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: llmOn ? C.ok : C.t3 }} />
            <span style={{ fontSize: 11, color: C.t3, fontFamily: "'JetBrains Mono', monospace" }}>{totalTok} tok</span>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: mobile ? "16px" : "24px 28px" }}>
          {showLLM ? <LLMPanel config={llmConfig} onChange={setLlmConfig} mobile={mobile} />
          : showChat ? <ChatPanel formData={formData} llmConfig={llmConfig} mobile={mobile} />
          : showTemplates && !showPreview ? (
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: C.t1, margin: "0 0 4px" }}>Templates</h2>
              <p style={{ fontSize: 12, color: C.t2, margin: "0 0 16px" }}>Pick a foundation, then customize.</p>
              <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                {TEMPLATES.map((t, i) => (
                  <button key={i} onClick={() => applyTemplate(t)} style={{
                    background: C.s2, border: "1px solid " + C.border, borderRadius: 10, padding: 14, cursor: "pointer", textAlign: "left", fontFamily: "inherit", transition: "border-color 0.2s",
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.t1, marginBottom: 3 }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: C.t2, marginBottom: 8 }}>{t.desc}</div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {t.tags.map((tag, j) => <Tag key={j} label={tag} colorKey={TAG_COLORS[j % 5]} />)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : showPreview ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: C.t1, margin: 0 }}>Compiled Output</h2>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {["markdown", "json"].map(f => (
                    <button key={f} onClick={() => setPreviewFmt(f)} style={{
                      padding: "5px 10px", borderRadius: 5, fontSize: 11, fontWeight: 600,
                      border: "1px solid " + (previewFmt === f ? C.accent : C.border),
                      background: previewFmt === f ? C.glow : "transparent",
                      color: previewFmt === f ? C.accent : C.t2, cursor: "pointer", fontFamily: "inherit",
                    }}>{f === "markdown" ? "Markdown" : "JSON (Tavern)"}</button>
                  ))}
                  <Btn onClick={handleCopy} variant={copied ? "success" : "primary"} style={{ padding: "5px 12px", fontSize: 11 }}>{copied ? "Copied!" : "Copy"}</Btn>
                </div>
              </div>
              <pre style={{
                background: C.s2, border: "1px solid " + C.border, borderRadius: 10, padding: mobile ? 14 : 20,
                fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: C.t1, lineHeight: 1.6,
                whiteSpace: "pre-wrap", wordBreak: "break-word", overflowY: "auto", maxHeight: "calc(100vh - 180px)",
              }}>{compiled || "Fill in sections to see output."}</pre>
            </div>
          ) : (
            <div style={{ maxWidth: 640 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <span style={{ fontSize: 20 }}>{SECTIONS.find(s => s.id === activeSection)?.icon}</span>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: C.t1, margin: 0 }}>{SECTIONS.find(s => s.id === activeSection)?.label}</h2>
              </div>
              <ActiveComp data={formData[activeSection] || {}} onChange={d => updateSec(activeSection, d)} />
            </div>
          )}
        </div>
      </div>

      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   MAIN APP — ORCHESTRATOR
   ══════════════════════════════════════════════════════════════ */

export default function SuperPromptBuilder() {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [publishedBots, setPublishedBots] = useState([...FEATURED_BOTS]);
  const [view, setView] = useState("auth"); // auth | discover | builder | admin
  const [formData, setFormData] = useState({ identity: {}, personality: {}, scenario: {}, dialogue: {}, lorebook: {}, system: {} });
  const [llmConfig, setLlmConfig] = useState({ preset: "custom", apiUrl: "", apiKey: "", proxyUrl: "", proxyKey: "", model: "", temperature: 0.85, maxTokens: 1024 });
  const mobile = useMobile();

  // Origin verification
  useEffect(() => {
    console.log("%cSuper Prompt Builder%c by Khaoskami — github.com/Khaoskami/super-prompt-builder — MIT 2025", "font-weight:bold;color:#3B82F6", "color:#8A95A8");
    if (typeof document !== "undefined") {
      let m = document.querySelector('meta[name="spb-origin"]');
      if (!m) { m = document.createElement("meta"); m.name = "spb-origin"; document.head.appendChild(m); }
      m.content = "Khaoskami::super-prompt-builder::MIT-2025::github.com/Khaoskami/super-prompt-builder";
    }
  }, []);

  const handleLogin = (user, isNew) => {
    if (user.banned) { return; }
    if (isNew) setUsers(p => [...p, user]);
    setCurrentUser(user);
    setView("discover");
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setView("auth");
    // Wipe sensitive state
    setLlmConfig({ preset: "custom", apiUrl: "", apiKey: "", proxyUrl: "", proxyKey: "", model: "", temperature: 0.85, maxTokens: 1024 });
  };

  const handleBanUser = (username) => {
    setUsers(p => p.map(u => u.username === username ? { ...u, banned: !u.banned } : u));
  };

  if (view === "auth" || !currentUser) {
    return <AuthScreen onLogin={handleLogin} users={users} />;
  }

  if (view === "admin" && currentUser.isAdmin) {
    return (
      <div style={{ minHeight: "100vh", background: C.base, fontFamily: "'DM Sans', sans-serif", color: C.t1, padding: mobile ? 16 : 32 }}>
        <AdminPanel users={users} bots={publishedBots} onBanUser={handleBanUser} onDeleteBot={(id) => setPublishedBots(p => p.filter(b => b.id !== id))} onBack={() => setView("discover")} mobile={mobile} />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </div>
    );
  }

  if (view === "builder") {
    return <BuilderView formData={formData} setFormData={setFormData} llmConfig={llmConfig} setLlmConfig={setLlmConfig} onBack={() => setView("discover")} user={currentUser} mobile={mobile} />;
  }

  return (
    <DiscoverPage
      bots={publishedBots}
      user={currentUser}
      onSelectBot={(bot) => {
        // Load bot into builder
        setFormData({
          identity: { name: bot.name, tagline: bot.tagline, avatar: bot.avatar },
          personality: {}, scenario: {}, dialogue: {}, lorebook: {}, system: {},
        });
        setView("builder");
      }}
      onOpenBuilder={() => {
        setFormData({ identity: {}, personality: {}, scenario: {}, dialogue: {}, lorebook: {}, system: {} });
        setView("builder");
      }}
      onLogout={handleLogout}
      onAdmin={() => setView("admin")}
      mobile={mobile}
    />
  );
}
