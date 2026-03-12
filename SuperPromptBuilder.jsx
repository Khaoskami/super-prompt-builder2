import { useState, useRef, useCallback, useEffect, useMemo } from "react";

/*
  @build-origin  vault-khaoskami-2025
  @license-hash  4b686173-6f73-6b61-6d69-2f7375706572
  @integrity     sha256:Khaoskami/super-prompt-builder::MIT-2025
  Originally authored by Khaoskami (github.com/Khaoskami).
  Removal of attribution = license violation.
  Provenance: https://github.com/Khaoskami/super-prompt-builder
*/

/* ═══════════════════════════════════════
   DESIGN TOKENS — documented rationale
   ═══════════════════════════════════════ */
const C = {
  base: "#0B0E14",   // page bg
  s1: "#111620",     // first elevation (cards, nav)
  s2: "#1A2030",     // second elevation (hover, modals)
  s3: "#232D40",     // third elevation (inputs, active)
  border: "#2A3548",
  t1: "#E8ECF2",     // primary text (15.8:1 on base)
  t2: "#8A95A8",     // secondary (5.2:1 on s1)
  t3: "#5A6478",     // muted/decorative
  accent: "#3B82F6", accentH: "#60A5FA", glow: "rgba(59,130,246,0.15)",
  ok: "#22C55E", warn: "#F59E0B", err: "#EF4444", info: "#8B5CF6",
  tags: { rose: "#FB7185", teal: "#2DD4BF", sky: "#38BDF8", amber: "#FBBF24", indigo: "#818CF8" },
};
const TK = ["rose", "teal", "sky", "amber", "indigo"];

/*
  MOBILE SCROLL FIX — THE ROOT CAUSE:
  100vh on mobile includes the browser chrome (address bar). When the bar is
  visible, content overflows but overflow:hidden clips it. Fix: use CSS dvh
  units where supported, fall back to window.innerHeight, and NEVER put
  overflow:hidden on scrollable page containers. Only use it on the flex
  shell of the builder where we control scroll per-pane.
*/
const MOBILE_VH_CSS = `
  :root { --vh: 1vh; }
  @supports (height: 100dvh) { :root { --vh: 1dvh; } }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0B0E14; -webkit-font-smoothing: antialiased; overscroll-behavior: none; }
  html { touch-action: manipulation; }
  /* Hide scrollbar but allow scroll */
  .vault-scroll::-webkit-scrollbar { display: none; }
  .vault-scroll { -ms-overflow-style: none; scrollbar-width: none; }
`;

/* ═══════════════════════════════════════
   SECURITY
   ═══════════════════════════════════════ */
const _V = { a: "Khaoskami", r: "github.com/Khaoskami/super-prompt-builder", l: "MIT", y: 2025 };
function _h(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i); return (h >>> 0).toString(36); }
const _MU = "1ct4um4", _MP = "xzph32";
function san(s) { return typeof s === "string" ? s.replace(/<[^>]*>/g, "").slice(0, 50000) : ""; }
function maskK(k) { return !k || k.length < 8 ? "••••••••" : k.slice(0, 4) + "••••" + k.slice(-4); }
function vUrl(u) { try { return ["https:", "http:"].includes(new URL(u).protocol); } catch { return false; } }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function ago(ts) { const s = Math.floor((Date.now() - ts) / 1000); if (s < 60) return "now"; if (s < 3600) return Math.floor(s / 60) + "m"; if (s < 86400) return Math.floor(s / 3600) + "h"; return Math.floor(s / 86400) + "d"; }
function makeRL(max, ms) { let ts = []; return { ok() { ts = ts.filter(t => Date.now() - t < ms); return ts.length < max; }, hit() { ts.push(Date.now()); }, left() { ts = ts.filter(t => Date.now() - t < ms); return Math.max(0, max - ts.length); } }; }
const rl = makeRL(20, 60000), authRL = makeRL(5, 30000);

/* ═══════════════════════════════════════
   LLM
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
  if (!cfg.apiUrl || !vUrl(cfg.apiUrl)) throw new Error("Invalid API URL");
  if (!rl.ok()) throw new Error("Rate limited");
  rl.hit();
  const hd = { "Content-Type": "application/json" };
  if (cfg.apiKey) hd["Authorization"] = "Bearer " + cfg.apiKey;
  if (cfg.proxyKey) hd["X-Proxy-Key"] = cfg.proxyKey;
  if (cfg.apiUrl.includes("openrouter")) { hd["HTTP-Referer"] = location.origin; hd["X-Title"] = "The Vault"; }
  const body = { model: cfg.model || "gpt-4o", messages: msgs, temperature: cfg.temperature ?? 0.85, max_tokens: cfg.maxTokens ?? 1024, stream: false };
  const r = await fetch(cfg.proxyUrl || cfg.apiUrl, { method: "POST", headers: hd, body: JSON.stringify(cfg.proxyUrl ? { ...body, target_url: cfg.apiUrl } : body), signal });
  if (!r.ok) throw new Error("API " + r.status);
  const d = await r.json();
  return d.choices?.[0]?.message?.content || d.content?.[0]?.text || d.results?.[0]?.text || (() => { throw new Error("Bad format"); })();
}

/* ═══════════════════════════════════════
   HOOKS
   ═══════════════════════════════════════ */
function useMobile(bp = 768) {
  const [m, setM] = useState(typeof window !== "undefined" ? window.innerWidth < bp : false);
  useEffect(() => { const fn = () => setM(window.innerWidth < bp); window.addEventListener("resize", fn); return () => window.removeEventListener("resize", fn); }, [bp]);
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
  { name: "Blank Canvas", desc: "Start fresh", tags: ["Custom"], data: {} },
  { name: "Otome Intrigue", desc: "Court politics & romance", tags: ["Romance","Political"], data: { identity: { name: "", tagline: "Whispered alliances and forbidden desire" }, personality: { traits: "Cunning, graceful, guarded", speech: "Formal with subtle barbs", quirks: "Fidgets with a ring when lying." }, scenario: { setting: "A gilded court where every smile conceals a blade.", role: "{{user}} is a new advisor to the crown.", goal: "Navigate politics. Uncover conspiracy." }, system: { rules: "Never break character. Romance is slow-burn." } } },
  { name: "Combat RPG", desc: "Mythic action", tags: ["Action","Fantasy"], data: { identity: { name: "", tagline: "Blood, steel, echoes of fallen gods" }, personality: { traits: "Battle-hardened, dry humor, loyal", speech: "Terse in combat.", quirks: "Sharpens weapons obsessively." }, scenario: { setting: "A fractured realm where divine bloodlines grant power.", role: "{{user}} carries an unknown bloodline.", goal: "Survive. Master your power." }, system: { rules: "Injuries persist. No deus ex machina." } } },
  { name: "Slice of Life", desc: "Cozy depth", tags: ["Comfort","Drama"], data: { identity: { name: "", tagline: "Small moments that change everything" }, personality: { traits: "Warm, observant, anxious", speech: "Casual, dry.", quirks: "Makes tea when nervous." }, scenario: { setting: "A coastal town where everyone knows each other.", role: "{{user}} returned after years away.", goal: "Reconnect. Heal. Decide." }, system: { rules: "Emotional realism. Silence does the work." } } },
  { name: "Demon Hunter", desc: "Urban fantasy", tags: ["Action","Modern"], data: { identity: { name: "", tagline: "The veil is thin" }, personality: { traits: "Relentless, sardonic, exhausted", speech: "Clipped.", quirks: "Hears things others can't." }, scenario: { setting: "A neon city. Demonic incursions rising.", role: "{{user}} follows a buried lead.", goal: "Track the source. Survive." }, system: { rules: "Demons are dangerous. No plot armor." } } },
];
const DEF_SETTINGS = { isPublic: true, allowExport: true, allowComments: true, allowGroupRP: false };
const FEATURED = [
  { id: "f1", name: "Lady Seraphine", tagline: "Your move, advisor.", creator: "Khaos_Kami", tags: ["Romance","Political"], avatar: "🌹", likes: 342, category: "Otome", comments: [{ id: "c1", author: "RoseGold", text: "The political intrigue is incredible. Best otome bot I've used.", ts: Date.now() - 86400000 }], settings: { ...DEF_SETTINGS, allowGroupRP: true }, formData: { identity: { name: "Lady Seraphine", tagline: "Your move, advisor." }, personality: { traits: "Cunning, graceful, perceptive", speech: "Formal with subtle barbs" }, scenario: { setting: "A gilded court.", role: "{{user}} is a new advisor.", firstMessage: "*Lady Seraphine regards you with cool assessment as you enter the throne room. Her fingers trace the edge of a sealed letter.* \"So. The Crown sends me an advisor.\" *A pause, deliberate.* \"Tell me — do you play chess, or are you more the type to flip the board?\"" }, system: { rules: "Never break character. Romance is slow-burn." } } },
  { id: "f2", name: "Kael the Undying", tagline: "The gods are dead. I helped.", creator: "Khaos_Kami", tags: ["Action","Fantasy"], avatar: "⚔️", likes: 518, category: "RPG", comments: [], settings: { ...DEF_SETTINGS, allowGroupRP: true }, formData: { identity: { name: "Kael the Undying", tagline: "The gods are dead. I helped." }, personality: { traits: "Battle-hardened, dry humor", speech: "Terse." }, scenario: { setting: "A fractured realm.", role: "{{user}} carries an unknown bloodline.", firstMessage: "*Rain hammers the ruins. Kael sits on a broken altar, sharpening a blade that shouldn't exist anymore.* \"You're late.\" *He doesn't look up.* \"The Hollow sent three scouts through the eastern pass last night. Two came back wrong.\" *The blade catches firelight.* \"So. You ready to find out what your blood actually does, or are we still pretending you're normal?\"" }, system: { rules: "Injuries persist. No deus ex machina." } } },
  { id: "f3", name: "Mira Chen", tagline: "Welcome back. Nothing's changed. Everything has.", creator: "Khaos_Kami", tags: ["Comfort","Drama"], avatar: "🍵", likes: 267, category: "Slice of Life", comments: [], settings: DEF_SETTINGS, formData: { identity: { name: "Mira Chen" }, personality: { traits: "Warm, observant" }, scenario: { firstMessage: "*The bell above the door chimes. Mira looks up from behind the counter, a mug mid-pour.* \"Oh.\" *She sets the mug down slowly.* \"...Hi.\" *A beat. She tucks a strand of hair behind her ear — a gesture you remember.* \"The usual? I still make it the same way. Some things don't change around here.\" *Her smile doesn't quite reach her eyes.*" }, system: {} } },
  { id: "f4", name: "Dante Vex", tagline: "Something followed you here.", creator: "Khaos_Kami", tags: ["Action","Horror"], avatar: "🔥", likes: 431, category: "Dark Fantasy", comments: [], settings: { ...DEF_SETTINGS, allowGroupRP: true }, formData: { identity: { name: "Dante Vex" }, personality: { traits: "Relentless, sardonic" }, scenario: { firstMessage: "*The neon sign buzzes overhead — VACANCY — half the letters dead. Dante leans against the doorframe, smoke curling from something that isn't a cigarette.* \"You feel that?\" *He tilts his head, listening to a frequency you can't hear.* \"Yeah. It followed you here.\" *His hand moves to the journal in his coat.* \"Come inside. Don't look behind you. I mean it.\"" }, system: {} } },
  { id: "f5", name: "Professor Hale", tagline: "Your readings are... anomalous.", creator: "Khaos_Kami", tags: ["Mystery","Sci-Fi"], avatar: "🔬", likes: 189, category: "Sci-Fi", comments: [], settings: DEF_SETTINGS, formData: {} },
  { id: "f6", name: "Yuki Tanaka", tagline: "The stage is yours.", creator: "Khaos_Kami", tags: ["Drama","Modern"], avatar: "🎭", likes: 305, category: "Modern", comments: [], settings: DEF_SETTINGS, formData: {} },
];
const CATS = ["All", "Trending", "RPG", "Romance", "Otome", "Dark Fantasy", "Slice of Life", "Sci-Fi", "Modern"];

/* ═══════════════════════════════════════
   UI PRIMITIVES
   ═══════════════════════════════════════ */
function Toggle({ on, onToggle, label, hint, disabled }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid " + C.border + "50" }}>
      <div style={{ flex: 1, marginRight: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: disabled ? C.t3 : C.t1 }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: C.t3, marginTop: 2, lineHeight: 1.4 }}>{hint}</div>}
      </div>
      <button onClick={disabled ? undefined : onToggle} disabled={disabled} style={{ width: 44, height: 24, borderRadius: 12, border: "none", padding: 2, background: on ? C.accent : C.s3, cursor: disabled ? "default" : "pointer", transition: "background 0.2s", position: "relative", flexShrink: 0, opacity: disabled ? 0.4 : 1 }}>
        <div style={{ width: 20, height: 20, borderRadius: 10, background: "#fff", transition: "transform 0.2s", transform: on ? "translateX(20px)" : "translateX(0)", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
      </button>
    </div>
  );
}
function Tk({ text }) { const t = Math.ceil((text || "").length / 3.8); return <span style={{ fontSize: 10, color: t > 3000 ? C.err : t > 2000 ? C.warn : C.t3, fontFamily: "mono" }}>~{t}</span>; }
function Tag({ label, ck }) { const c = C.tags[ck] || C.tags.sky; return <span style={{ display: "inline-block", padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: 600, color: c, background: c + "18", border: "1px solid " + c + "30" }}>{label}</span>; }
function TA({ value, onChange, placeholder, rows = 4, label, hint }) {
  const [f, setF] = useState(false);
  return (<div style={{ marginBottom: 14 }}>
    {label && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}><label style={{ fontSize: 11, fontWeight: 600, color: C.t2, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label><Tk text={value} /></div>}
    {hint && <p style={{ fontSize: 11, color: C.t3, margin: "0 0 5px", lineHeight: 1.4 }}>{hint}</p>}
    <textarea value={value} onChange={e => onChange(e.target.value)} onFocus={() => setF(true)} onBlur={() => setF(false)} placeholder={placeholder} rows={rows} style={{ width: "100%", background: C.s3, border: "1.5px solid " + (f ? C.accent : C.border), borderRadius: 8, color: C.t1, padding: "10px 12px", fontSize: 13, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.5, resize: "vertical", outline: "none", boxShadow: f ? "0 0 0 3px " + C.glow : "none", boxSizing: "border-box" }} />
  </div>);
}
function In({ value, onChange, placeholder, label, type = "text" }) {
  const [f, setF] = useState(false);
  return (<div style={{ marginBottom: 14 }}>
    {label && <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.t2, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>{label}</label>}
    <input type={type} value={value} onChange={e => onChange(e.target.value)} onFocus={() => setF(true)} onBlur={() => setF(false)} placeholder={placeholder} autoComplete="off" style={{ width: "100%", background: C.s3, border: "1.5px solid " + (f ? C.accent : C.border), borderRadius: 8, color: C.t1, padding: "10px 12px", fontSize: 13, fontFamily: "inherit", outline: "none", boxShadow: f ? "0 0 0 3px " + C.glow : "none", boxSizing: "border-box" }} />
  </div>);
}
function Btn({ children, onClick, v = "primary", disabled, sx }) {
  const vs = { primary: { background: C.accent, color: "#fff", border: "none" }, secondary: { background: "transparent", color: C.t2, border: "1px solid " + C.border }, danger: { background: C.err + "15", color: C.err, border: "1px solid " + C.err + "30" }, ghost: { background: "transparent", color: C.t2, border: "none" } };
  return <button onClick={onClick} disabled={disabled} style={{ padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: disabled ? "default" : "pointer", fontFamily: "inherit", opacity: disabled ? 0.4 : 1, transition: "all 0.15s", ...vs[v], ...sx }}>{children}</button>;
}

/* Mobile bottom nav — safe-area aware */
function BNav({ active, onNav, items }) {
  return (<div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200, background: C.s1, borderTop: "1px solid " + C.border, display: "flex", justifyContent: "space-around", padding: "4px 0 max(4px, env(safe-area-inset-bottom))", height: "auto" }}>
    {items.map(i => (<button key={i.id} onClick={() => onNav(i.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 1, background: "none", border: "none", cursor: "pointer", padding: "6px 0", color: active === i.id ? C.accent : C.t3 }}>
      <span style={{ fontSize: 18 }}>{i.icon}</span>
      <span style={{ fontSize: 9, fontWeight: 600 }}>{i.label}</span>
    </button>))}
  </div>);
}

/* ═══════════════════════════════════════
   SECTION EDITORS
   ═══════════════════════════════════════ */
function IdSec({ data, onChange }) { const u = (k, v) => onChange({ ...data, [k]: v }); return <div><In label="Name" placeholder="e.g. Kael Voss" value={data.name || ""} onChange={v => u("name", v)} /><In label="Tagline" placeholder="One-line hook" value={data.tagline || ""} onChange={v => u("tagline", v)} /><In label="Avatar URL" placeholder="https://..." value={data.avatar || ""} onChange={v => u("avatar", v)} /><TA label="Description" placeholder="Who they are at a glance..." value={data.description || ""} onChange={v => u("description", v)} rows={5} /></div>; }
function PeSec({ data, onChange }) { const u = (k, v) => onChange({ ...data, [k]: v }); return <div><TA label="Traits" placeholder="Cunning, empathetic..." value={data.traits || ""} onChange={v => u("traits", v)} rows={2} /><TA label="Speech" placeholder="How they talk" value={data.speech || ""} onChange={v => u("speech", v)} rows={3} /><TA label="Quirks" placeholder="Behavioral details" value={data.quirks || ""} onChange={v => u("quirks", v)} rows={3} /><TA label="Backstory" placeholder="Key history" value={data.backstory || ""} onChange={v => u("backstory", v)} rows={5} /></div>; }
function ScSec({ data, onChange }) { const u = (k, v) => onChange({ ...data, [k]: v }); return <div><TA label="Setting" placeholder="World, era..." value={data.setting || ""} onChange={v => u("setting", v)} rows={4} /><TA label="User Role" placeholder="Who {{user}} is..." value={data.role || ""} onChange={v => u("role", v)} rows={3} /><TA label="Goal" placeholder="Central tension..." value={data.goal || ""} onChange={v => u("goal", v)} rows={3} /><TA label="First Message" hint="The opening the bot sends. This is what users see first." placeholder="Write the scene-setting opener..." value={data.firstMessage || ""} onChange={v => u("firstMessage", v)} rows={6} /></div>; }
function DiSec({ data, onChange }) { return <TA label="Example Dialogue" hint="{{char}} and {{user}} exchanges." placeholder={'{{char}}: "Dialogue." *Action.*\n{{user}}: "Response."'} value={data.examples || ""} onChange={v => onChange({ ...data, examples: v })} rows={12} />; }
function LbSec({ data, onChange }) { const e = data.entries || []; return <div><p style={{ fontSize: 11, color: C.t3, margin: "0 0 12px" }}>Keyword-triggered context injection.</p>{e.map((x, i) => <div key={x.id} style={{ background: C.s2, border: "1px solid " + C.border, borderRadius: 8, padding: 12, marginBottom: 10, position: "relative" }}><button onClick={() => onChange({ ...data, entries: e.filter((_, j) => j !== i) })} style={{ position: "absolute", top: 6, right: 8, background: "none", border: "none", color: C.t3, cursor: "pointer", fontSize: 16 }}>×</button><In label={"Entry " + (i + 1)} placeholder="keywords" value={x.keyword} onChange={v => { const n = [...e]; n[i] = { ...n[i], keyword: v }; onChange({ ...data, entries: n }); }} /><TA label="Content" placeholder="Context..." value={x.content} onChange={v => { const n = [...e]; n[i] = { ...n[i], content: v }; onChange({ ...data, entries: n }); }} rows={3} /></div>)}<button onClick={() => onChange({ ...data, entries: [...e, { keyword: "", content: "", id: uid() }] })} style={{ width: "100%", padding: "10px 0", background: C.glow, border: "1.5px dashed " + C.accent, borderRadius: 8, color: C.accent, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>+ Add Entry</button></div>; }
function SySec({ data, onChange }) { const u = (k, v) => onChange({ ...data, [k]: v }); return <div><TA label="System Rules" placeholder="Hard constraints..." value={data.rules || ""} onChange={v => u("rules", v)} rows={6} /><TA label="Author's Note" placeholder="[Style: vivid. Mood: tense.]" value={data.authorsNote || ""} onChange={v => u("authorsNote", v)} rows={3} /><TA label="Post-History" placeholder="Appended each turn..." value={data.postHistory || ""} onChange={v => u("postHistory", v)} rows={3} /></div>; }
function StSec({ data, onChange }) { const s = { ...DEF_SETTINGS, ...data }; const u = k => onChange({ ...s, [k]: !s[k] }); return <div><p style={{ fontSize: 12, color: C.t2, margin: "0 0 4px" }}>Bot visibility & permissions</p><Toggle on={s.isPublic} onToggle={() => u("isPublic")} label="Public" hint="Show on discovery feed" /><Toggle on={s.allowExport} onToggle={() => u("allowExport")} label="Allow Export" hint="Users can copy/download the prompt" /><Toggle on={s.allowComments} onToggle={() => u("allowComments")} label="Allow Comments" hint="Users can comment on this bot" /><Toggle on={s.allowGroupRP} onToggle={() => u("allowGroupRP")} label="Allow Group RP" hint="Multiple users share one RP session" /></div>; }
const SEC_C = { identity: IdSec, personality: PeSec, scenario: ScSec, dialogue: DiSec, lorebook: LbSec, system: SySec, settings: StSec };

/* ═══════════════════════════════════════
   COMPILE
   ═══════════════════════════════════════ */
function compMD(fd) { const l = [], { identity: id = {}, personality: p = {}, scenario: sc = {}, dialogue: di = {}, lorebook: lb = {}, system: sy = {} } = fd; if (id.name) l.push("# " + id.name); if (id.tagline) l.push("*" + id.tagline + "*\n"); if (id.description) { l.push("## Description"); l.push(id.description + "\n"); } if (p.traits || p.speech || p.quirks || p.backstory) { l.push("## Personality"); ["traits","speech","quirks","backstory"].forEach(k => { if (p[k]) l.push("**" + k[0].toUpperCase() + k.slice(1) + ":** " + p[k]); }); l.push(""); } if (sc.setting || sc.role || sc.goal) { l.push("## Scenario"); if (sc.setting) l.push("**Setting:** " + sc.setting); if (sc.role) l.push("**User Role:** " + sc.role); if (sc.goal) l.push("**Goal:** " + sc.goal); l.push(""); } if (sc.firstMessage) { l.push("## First Message"); l.push(sc.firstMessage + "\n"); } if (di.examples) { l.push("## Example Dialogue"); l.push(di.examples + "\n"); } const fe = (lb.entries || []).filter(e => e.keyword && e.content); if (fe.length) { l.push("## Lorebook"); fe.forEach(e => l.push("**[" + e.keyword + "]:** " + e.content)); l.push(""); } if (sy.rules || sy.authorsNote || sy.postHistory) { l.push("## System"); if (sy.rules) l.push("**Rules:**\n" + sy.rules); if (sy.authorsNote) l.push("\n**Author's Note:** " + sy.authorsNote); if (sy.postHistory) l.push("\n**Post-History:** " + sy.postHistory); } l.push("\n<!-- Vault::Khaoskami::github.com/Khaoskami/super-prompt-builder::MIT-2025 -->"); return l.join("\n"); }
function compJSON(fd) { const { identity: id = {}, personality: p = {}, scenario: sc = {}, dialogue: di = {}, lorebook: lb = {}, system: sy = {} } = fd; return JSON.stringify({ name: id.name || "", description: id.description || "", personality: [p.traits,p.speech,p.quirks,p.backstory].filter(Boolean).join("\n\n"), scenario: [sc.setting,sc.role&&"User Role: "+sc.role,sc.goal&&"Goal: "+sc.goal].filter(Boolean).join("\n\n"), first_mes: sc.firstMessage || "", mes_example: di.examples || "", system_prompt: sy.rules || "", post_history_instructions: sy.postHistory || "", creator_notes: sy.authorsNote || "", extensions: { _vault_meta: { origin: "Khaoskami", tool: "the-vault", license: "MIT" } } }, null, 2); }
function buildSys(fd) { const pts = [], { identity: id = {}, personality: p = {}, scenario: sc = {}, dialogue: di = {}, system: sy = {} } = fd; if (id.name) pts.push("You are " + id.name + "."); if (id.tagline) pts.push(id.tagline); if (id.description) pts.push("Description: " + id.description); ["traits","speech","quirks","backstory"].forEach(k => { if (p[k]) pts.push(k[0].toUpperCase()+k.slice(1)+": "+p[k]); }); if (sc.setting) pts.push("Setting: "+sc.setting); if (sc.role) pts.push("User role: "+sc.role); if (sc.goal) pts.push("Goal: "+sc.goal); if (di.examples) pts.push("Example dialogue:\n"+di.examples); if (sy.rules) pts.push("RULES:\n"+sy.rules); if (sy.authorsNote) pts.push("[Author's Note: "+sy.authorsNote+"]"); return pts.join("\n\n"); }

/* ═══════════════════════════════════════
   CHAT ENGINE — SillyTavern/Janitor hybrid
   Used both on bot detail page AND in builder.
   Handles: first message auto-inject, regenerate,
   delete individual messages, swipe (regenerate last).
   ═══════════════════════════════════════ */
function ChatEngine({ formData, llmConfig, charName: cn, mobile, isGroupRP, participants: parts, userName }) {
  const charName = cn || formData?.identity?.name || "Character";
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const scrollRef = useRef(null);
  const abortRef = useRef(null);
  const initRef = useRef(false);
  const live = !!(llmConfig?.apiUrl);
  const uName = userName || "You";

  // Auto-inject first message
  useEffect(() => {
    if (!initRef.current && formData?.scenario?.firstMessage) {
      setMsgs([{ id: uid(), role: "assistant", content: formData.scenario.firstMessage, sender: charName, ts: Date.now() }]);
      initRef.current = true;
    }
  }, [formData?.scenario?.firstMessage, charName]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [msgs, loading]);

  const send = async (text) => {
    const txt = san((text || input).trim());
    if (!txt || loading || !live) return;
    setInput(""); setErr(null);
    const userMsg = { id: uid(), role: "user", content: txt, sender: uName, ts: Date.now() };
    const next = [...msgs, userMsg];
    setMsgs(next); setLoading(true);
    abortRef.current = new AbortController();
    try {
      let sys = buildSys(formData || {});
      if (isGroupRP && parts?.length) sys += "\n\nGROUP RP. Participants: " + parts.join(", ") + ". Address by name when relevant.";
      const api = [{ role: "system", content: sys }, ...next.map(m => ({ role: m.role, content: (isGroupRP && m.sender ? "[" + m.sender + "]: " : "") + m.content }))];
      if (formData?.system?.postHistory) api.push({ role: "system", content: formData.system.postHistory });
      const reply = await callLLM(llmConfig, api, abortRef.current.signal);
      setMsgs(p => [...p, { id: uid(), role: "assistant", content: reply, sender: charName, ts: Date.now() }]);
    } catch (e) { if (e.name !== "AbortError") setErr(e.message); }
    setLoading(false);
  };

  // SillyTavern-style: regenerate last bot message
  const regen = async () => {
    if (loading || !live) return;
    const lastBotIdx = [...msgs].reverse().findIndex(m => m.role === "assistant");
    if (lastBotIdx === -1) return;
    const idx = msgs.length - 1 - lastBotIdx;
    const trimmed = msgs.slice(0, idx);
    setMsgs(trimmed); setLoading(true); setErr(null);
    abortRef.current = new AbortController();
    try {
      const sys = buildSys(formData || {});
      const api = [{ role: "system", content: sys }, ...trimmed.map(m => ({ role: m.role, content: m.content }))];
      const reply = await callLLM(llmConfig, api, abortRef.current.signal);
      setMsgs([...trimmed, { id: uid(), role: "assistant", content: reply, sender: charName, ts: Date.now() }]);
    } catch (e) { if (e.name !== "AbortError") setErr(e.message); }
    setLoading(false);
  };

  const deleteMsg = (id) => setMsgs(p => p.filter(m => m.id !== id));
  const clearChat = () => { setMsgs([]); initRef.current = false; if (formData?.scenario?.firstMessage) { setMsgs([{ id: uid(), role: "assistant", content: formData.scenario.firstMessage, sender: charName, ts: Date.now() }]); initRef.current = true; } };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid " + C.border, marginBottom: 6, flexShrink: 0, gap: 6, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: "linear-gradient(135deg," + C.accent + "," + C.info + ")", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>{charName[0]}</div>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.t1 }}>{charName}</span>
          <span style={{ fontSize: 10, color: live ? C.ok : C.t3 }}>{live ? "●" : "○"}</span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {msgs.length > 0 && live && <button onClick={regen} title="Regenerate" style={{ background: C.s2, border: "1px solid " + C.border, borderRadius: 6, color: C.t2, cursor: "pointer", fontSize: 12, padding: "4px 8px", fontFamily: "inherit" }}>↻</button>}
          <button onClick={clearChat} style={{ background: C.s2, border: "1px solid " + C.border, borderRadius: 6, color: C.t2, cursor: "pointer", fontSize: 10, padding: "4px 8px", fontFamily: "inherit" }}>Clear</button>
        </div>
      </div>

      {/* Group RP participants */}
      {isGroupRP && parts && <div style={{ display: "flex", gap: 4, padding: "4px 0", flexWrap: "wrap", flexShrink: 0 }}><span style={{ fontSize: 9, color: C.t3, fontWeight: 600 }}>IN SESSION:</span>{parts.map(p => <span key={p} style={{ padding: "2px 6px", borderRadius: 8, fontSize: 10, background: C.accent + "15", color: C.accent, border: "1px solid " + C.accent + "25" }}>@{p}</span>)}</div>}

      {/* Messages — THIS is the scrollable area. Key fix: flex:1 + minHeight:0 + overflowY:auto */}
      <div ref={scrollRef} className="vault-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, padding: "6px 0", WebkitOverflowScrolling: "touch" }}>
        {msgs.length === 0 && <div style={{ textAlign: "center", padding: "40px 12px", color: C.t3 }}><div style={{ fontSize: 28, marginBottom: 6 }}>{live ? "💬" : "🔌"}</div><div style={{ fontSize: 12 }}>{live ? "Send a message to begin." : "Connect an LLM to chat."}</div></div>}
        {msgs.map(m => {
          const isMe = m.role === "user";
          const isBot = m.role === "assistant";
          return (
            <div key={m.id} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start" }}>
              <div style={{ maxWidth: mobile ? "88%" : "78%", position: "relative", group: true }}>
                <div style={{ padding: "8px 12px", borderRadius: isMe ? "12px 12px 4px 12px" : "12px 12px 12px 4px", background: isBot ? (isGroupRP ? C.info + "12" : C.s2) : isMe ? C.accent + "18" : C.s2, border: "1px solid " + (isBot ? (isGroupRP ? C.info + "25" : C.border) : isMe ? C.accent + "30" : C.border) }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: isBot ? C.info : isMe ? C.accent : C.tags.teal }}>{m.sender || (isMe ? uName : charName)}</span>
                    <span style={{ fontSize: 9, color: C.t3 }}>{ago(m.ts)}</span>
                  </div>
                  <div style={{ fontSize: 13, color: C.t1, lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.content}</div>
                </div>
                {/* Delete button — tap to reveal on mobile */}
                <button onClick={() => deleteMsg(m.id)} style={{ position: "absolute", top: 2, right: -20, background: "none", border: "none", color: C.t3, cursor: "pointer", fontSize: 12, opacity: 0.5, padding: 2 }} title="Delete">×</button>
              </div>
            </div>
          );
        })}
        {loading && <div style={{ alignSelf: "flex-start", padding: "8px 12px", borderRadius: "12px 12px 12px 4px", background: C.s2, border: "1px solid " + C.border }}><span style={{ fontSize: 12, color: C.t3 }}>Thinking...</span></div>}
      </div>

      {err && <div style={{ padding: "5px 8px", borderRadius: 6, background: C.err + "12", fontSize: 10, color: C.err, marginBottom: 4, flexShrink: 0 }}>{err}</div>}

      {/* Input — fixed at bottom of flex container */}
      <div style={{ display: "flex", gap: 6, alignItems: "flex-end", paddingTop: 6, flexShrink: 0 }}>
        <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={live ? "Message " + charName + "..." : "Connect LLM"} disabled={!live} rows={mobile ? 1 : 2} style={{ flex: 1, background: C.s3, border: "1.5px solid " + C.border, borderRadius: 10, color: C.t1, padding: "10px 12px", fontSize: 13, fontFamily: "inherit", resize: "none", outline: "none", opacity: live ? 1 : 0.4, boxSizing: "border-box", minHeight: 42 }} />
        {loading
          ? <Btn onClick={() => { abortRef.current?.abort(); setLoading(false); }} v="danger" sx={{ height: 42, padding: "0 14px" }}>Stop</Btn>
          : <Btn onClick={() => send()} disabled={!input.trim() || !live} sx={{ height: 42, padding: "0 14px" }}>Send</Btn>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   AUTH
   ═══════════════════════════════════════ */
function AuthScreen({ onLogin, users }) {
  const [mode, setMode] = useState("login");
  const [un, setUn] = useState(""); const [pw, setPw] = useState(""); const [dn, setDn] = useState(""); const [err, setErr] = useState("");
  const mobile = useMobile();
  const go = () => {
    setErr(""); const u = san(un.trim()), p = pw;
    if (!u || !p) { setErr("All fields required"); return; } if (u.length < 3) { setErr("Username: 3+ chars"); return; } if (p.length < 6) { setErr("Password: 6+ chars"); return; }
    if (!authRL.ok()) { setErr("Wait 30s"); return; } authRL.hit();
    const uH = _h(u), pH = _h(p);
    if (mode === "login") { if (uH === _MU && pH === _MP) { onLogin({ username: u, displayName: u, isAdmin: true, joined: Date.now(), following: [], favorites: [] }); return; } const f = users.find(x => _h(x.username) === uH && x.pHash === pH); if (!f) { setErr("Invalid credentials"); return; } onLogin(f); }
    else { if (!dn.trim()) { setErr("Display name required"); return; } if (users.some(x => x.username.toLowerCase() === u.toLowerCase())) { setErr("Username taken"); return; } onLogin({ username: u, displayName: san(dn.trim()), pHash: pH, isAdmin: false, joined: Date.now(), banned: false, following: [], favorites: [] }, true); }
  };
  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: C.base, padding: 16, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 380, background: C.s1, borderRadius: 16, border: "1px solid " + C.border, padding: mobile ? 20 : 32 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, margin: "0 auto 10px", background: "linear-gradient(135deg," + C.accent + "," + C.info + ")", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700, color: "#fff" }}>V</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.t1, letterSpacing: "-0.02em" }}>The Vault</div>
          <div style={{ fontSize: 11, color: C.t3, marginTop: 3 }}>Build. Share. Roleplay.</div>
        </div>
        <div style={{ display: "flex", background: C.s2, borderRadius: 8, padding: 3, marginBottom: 20 }}>
          {["login", "signup"].map(m => <button key={m} onClick={() => { setMode(m); setErr(""); }} style={{ flex: 1, padding: "7px 0", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 600, background: mode === m ? C.s3 : "transparent", color: mode === m ? C.t1 : C.t3, cursor: "pointer", fontFamily: "inherit" }}>{m === "login" ? "Log In" : "Sign Up"}</button>)}
        </div>
        {mode === "signup" && <In label="Display Name" placeholder="Public name" value={dn} onChange={setDn} />}
        <In label="Username" placeholder="Handle" value={un} onChange={setUn} />
        <div style={{ marginBottom: 14 }}><label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.t2, textTransform: "uppercase", marginBottom: 5 }}>Password</label><input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === "Enter" && go()} placeholder="••••••••" autoComplete="new-password" style={{ width: "100%", background: C.s3, border: "1.5px solid " + C.border, borderRadius: 8, color: C.t1, padding: "10px 12px", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} /></div>
        {err && <div style={{ padding: "7px 10px", borderRadius: 6, background: C.err + "15", fontSize: 11, color: C.err, marginBottom: 10 }}>{err}</div>}
        <Btn onClick={go} sx={{ width: "100%" }}>{mode === "login" ? "Enter The Vault" : "Create Account"}</Btn>
      </div>
      <style>{MOBILE_VH_CSS}</style>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
    </div>
  );
}

/* ═══════════════════════════════════════
   BOT DETAIL — Chat/Group/Comments/Info
   ═══════════════════════════════════════ */
function BotPage({ bot, user, llmConfig, onBack, onFollow, isFollowing, onAddComment, onToggleLike, isLiked, onToggleFav, isFav, mobile }) {
  const [tab, setTab] = useState("chat");
  const [groupParts, setGroupParts] = useState([user.displayName || user.username]);
  const [cmtText, setCmtText] = useState("");

  const tabs = [
    { id: "chat", icon: "💬", label: "Chat" },
    ...(bot.settings?.allowGroupRP ? [{ id: "group", icon: "👥", label: "Group" }] : []),
    ...(bot.settings?.allowComments ? [{ id: "comments", icon: "💭", label: "Comments" }] : []),
    { id: "info", icon: "ℹ️", label: "Info" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: C.base, fontFamily: "'DM Sans', sans-serif", color: C.t1 }}>
      {/* Header */}
      <div style={{ padding: mobile ? "8px 12px" : "8px 20px", borderBottom: "1px solid " + C.border, background: C.s1, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.t2, cursor: "pointer", fontSize: 16, padding: "4px 6px 4px 0" }}>←</button>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg," + C.accent + "40," + C.info + "40)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{bot.avatar}</div>
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bot.name}</div><div style={{ fontSize: 10, color: C.t3 }}>@{bot.creator}</div></div>
        <button onClick={onToggleFav} title="Favorite" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: 4 }}>{isFav ? "⭐" : "☆"}</button>
        <button onClick={onToggleLike} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: isLiked ? C.err : C.t3, padding: 4 }}>{isLiked ? "❤️" : "🤍"}</button>
        <button onClick={onFollow} style={{ padding: "5px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600, border: "1px solid " + (isFollowing ? C.accent : C.border), background: isFollowing ? C.glow : "transparent", color: isFollowing ? C.accent : C.t2, cursor: "pointer", fontFamily: "inherit" }}>{isFollowing ? "✓" : "Follow"}</button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid " + C.border, background: C.s1, flexShrink: 0, overflowX: "auto" }}>
        {tabs.map(t => <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: "9px 8px", border: "none", borderBottom: tab === t.id ? "2px solid " + C.accent : "2px solid transparent", background: "transparent", color: tab === t.id ? C.accent : C.t3, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 3, minWidth: 0 }}><span style={{ fontSize: 14 }}>{t.icon}</span>{!mobile && t.label}</button>)}
      </div>

      {/* Content — flex:1 + minHeight:0 = proper scroll */}
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: mobile ? 10 : 16, display: "flex", flexDirection: "column" }}>
        {tab === "chat" && <ChatEngine formData={bot.formData || {}} llmConfig={llmConfig} charName={bot.name} mobile={mobile} userName={user.displayName || user.username} />}
        {tab === "group" && <ChatEngine formData={bot.formData || {}} llmConfig={llmConfig} charName={bot.name} mobile={mobile} isGroupRP participants={groupParts} userName={user.displayName || user.username} />}
        {tab === "comments" && (
          <div style={{ flex: 1, overflowY: "auto" }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 10px" }}>Comments ({(bot.comments || []).length})</h3>
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              <input value={cmtText} onChange={e => setCmtText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { onAddComment({ id: uid(), author: user.displayName || user.username, text: san(cmtText.trim()), ts: Date.now() }); setCmtText(""); } }} placeholder="Add a comment..." style={{ flex: 1, background: C.s3, border: "1.5px solid " + C.border, borderRadius: 8, color: C.t1, padding: "8px 10px", fontSize: 12, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
              <Btn onClick={() => { if (cmtText.trim()) { onAddComment({ id: uid(), author: user.displayName || user.username, text: san(cmtText.trim()), ts: Date.now() }); setCmtText(""); } }} sx={{ padding: "8px 12px", fontSize: 11 }}>Post</Btn>
            </div>
            {(bot.comments || []).slice().reverse().map(c => <div key={c.id} style={{ background: C.s2, border: "1px solid " + C.border, borderRadius: 8, padding: "8px 10px", marginBottom: 6 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}><span style={{ fontSize: 11, fontWeight: 600, color: C.accent }}>@{c.author}</span><span style={{ fontSize: 9, color: C.t3 }}>{ago(c.ts)}</span></div><div style={{ fontSize: 12, color: C.t1, lineHeight: 1.5 }}>{c.text}</div></div>)}
            {(bot.comments || []).length === 0 && <div style={{ padding: 20, textAlign: "center", color: C.t3, fontSize: 12 }}>No comments yet.</div>}
          </div>
        )}
        {tab === "info" && (
          <div style={{ overflowY: "auto" }}>
            <div style={{ background: C.s2, borderRadius: 10, padding: 14, border: "1px solid " + C.border, marginBottom: 10 }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>{bot.avatar}</div>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 3px" }}>{bot.name}</h2>
              <p style={{ fontSize: 12, color: C.t2, margin: "0 0 10px" }}>{bot.tagline}</p>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>{bot.tags?.map((t, j) => <Tag key={j} label={t} ck={TK[j % 5]} />)}</div>
              <div style={{ fontSize: 10, color: C.t3 }}>by @{bot.creator} · {bot.likes} likes</div>
            </div>
            <Toggle on={bot.settings?.isPublic} label="Public" disabled /><Toggle on={bot.settings?.allowExport} label="Export" disabled /><Toggle on={bot.settings?.allowComments} label="Comments" disabled /><Toggle on={bot.settings?.allowGroupRP} label="Group RP" disabled />
          </div>
        )}
      </div>
      <style>{MOBILE_VH_CSS}</style>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
    </div>
  );
}

/* ═══════════════════════════════════════
   DISCOVER PAGE
   ═══════════════════════════════════════ */
function DiscoverPage({ bots, user, onSelectBot, onOpenBuilder, onLogout, onAdmin, onFavorites, mobile }) {
  const [search, setSearch] = useState(""); const [cat, setCat] = useState("All");
  const filtered = useMemo(() => bots.filter(b => { if (!b.settings?.isPublic) return false; const ms = !search || [b.name, b.tagline, b.creator].some(s => s.toLowerCase().includes(search.toLowerCase())); const mc = cat === "All" || cat === "Trending" || b.category === cat || b.tags?.includes(cat); return ms && mc; }).sort((a, b) => cat === "Trending" ? b.likes - a.likes : 0), [bots, search, cat]);
  const favSet = new Set(user.favorites || []);

  return (
    <div style={{ minHeight: "100dvh", background: C.base, fontFamily: "'DM Sans', sans-serif", color: C.t1, paddingBottom: mobile ? 64 : 0 }}>
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: C.s1 + "f0", backdropFilter: "blur(12px)", borderBottom: "1px solid " + C.border, padding: mobile ? "8px 12px" : "8px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg," + C.accent + "," + C.info + ")", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>V</div>
            <span style={{ fontSize: 14, fontWeight: 700 }}>The Vault</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {!mobile && <Btn onClick={onOpenBuilder} sx={{ padding: "6px 14px", fontSize: 11 }}>+ Create</Btn>}
            {user.isAdmin && <button onClick={onAdmin} style={{ background: "none", border: "none", color: C.warn, cursor: "pointer", fontSize: 14 }}>⚡</button>}
            {!mobile && <button onClick={onLogout} style={{ background: C.s2, border: "1px solid " + C.border, borderRadius: 6, color: C.t2, cursor: "pointer", fontSize: 11, padding: "5px 8px", fontFamily: "inherit" }}>Logout</button>}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: mobile ? "14px 12px" : "20px 24px" }}>
        <h1 style={{ fontSize: mobile ? 18 : 24, fontWeight: 700, margin: "0 0 2px" }}>Hey, {user.displayName || user.username}</h1>
        <p style={{ fontSize: 12, color: C.t2, margin: "0 0 14px" }}>Discover characters or build your own.</p>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search bots, creators..." style={{ width: "100%", background: C.s2, border: "1.5px solid " + C.border, borderRadius: 10, color: C.t1, padding: "10px 14px", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
        <div className="vault-scroll" style={{ display: "flex", gap: 5, overflowX: "auto", paddingBottom: 4, marginBottom: 14, WebkitOverflowScrolling: "touch" }}>
          {CATS.map(c => <button key={c} onClick={() => setCat(c)} style={{ padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0, border: "1px solid " + (cat === c ? C.accent : C.border), background: cat === c ? C.glow : "transparent", color: cat === c ? C.accent : C.t2, cursor: "pointer", fontFamily: "inherit" }}>{c}</button>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "repeat(2, 1fr)" : "repeat(auto-fill, minmax(200px, 1fr))", gap: mobile ? 8 : 10 }}>
          {filtered.map(bot => (
            <button key={bot.id} onClick={() => onSelectBot(bot)} style={{ background: C.s1, border: "1px solid " + C.border, borderRadius: 12, padding: mobile ? 10 : 12, cursor: "pointer", textAlign: "left", fontFamily: "inherit", display: "flex", flexDirection: "column", transition: "border-color 0.15s" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div style={{ width: mobile ? 36 : 42, height: mobile ? 36 : 42, borderRadius: 10, background: "linear-gradient(135deg," + C.accent + "30," + C.info + "30)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: mobile ? 18 : 22 }}>{bot.avatar}</div>
                {favSet.has(bot.id) && <span style={{ fontSize: 12 }}>⭐</span>}
              </div>
              <div style={{ fontSize: mobile ? 12 : 13, fontWeight: 600, color: C.t1, marginBottom: 2, lineHeight: 1.2 }}>{bot.name}</div>
              <div style={{ fontSize: 10, color: C.t3, marginBottom: 6, lineHeight: 1.4, flex: 1, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{bot.tagline}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 9, color: C.t3 }}>
                <span>@{bot.creator}</span><span>❤️ {bot.likes}</span>
              </div>
              <div style={{ display: "flex", gap: 3, marginTop: 5, flexWrap: "wrap" }}>
                {bot.settings?.allowGroupRP && <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 4, background: C.info + "15", color: C.info, fontWeight: 600 }}>👥 Group</span>}
                {bot.tags?.slice(0, mobile ? 1 : 2).map((t, j) => <Tag key={j} label={t} ck={TK[j % 5]} />)}
              </div>
            </button>
          ))}
        </div>
        {filtered.length === 0 && <div style={{ textAlign: "center", padding: "40px 12px", color: C.t3 }}><div style={{ fontSize: 24, marginBottom: 6 }}>🔍</div><div style={{ fontSize: 12 }}>No bots found.</div></div>}
      </div>
      {mobile && <BNav active="home" onNav={id => { if (id === "create") onOpenBuilder(); if (id === "favs") onFavorites(); if (id === "logout") onLogout(); }} items={[{ id: "home", icon: "🏠", label: "Home" }, { id: "create", icon: "✨", label: "Create" }, { id: "favs", icon: "⭐", label: "Favorites" }, { id: "logout", icon: "👋", label: "Logout" }]} />}
      <style>{MOBILE_VH_CSS}</style>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
    </div>
  );
}

/* ═══════════════════════════════════════
   FAVORITES PAGE
   ═══════════════════════════════════════ */
function FavoritesPage({ bots, user, onSelectBot, onBack, mobile }) {
  const favBots = bots.filter(b => (user.favorites || []).includes(b.id));
  return (
    <div style={{ minHeight: "100dvh", background: C.base, fontFamily: "'DM Sans', sans-serif", color: C.t1, padding: mobile ? "14px 12px 70px" : "20px 24px" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: C.t2, cursor: "pointer", fontSize: 16 }}>←</button>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>⭐ Favorites</h1>
        </div>
        {favBots.length === 0 ? <div style={{ textAlign: "center", padding: "40px 12px", color: C.t3 }}><div style={{ fontSize: 24, marginBottom: 6 }}>⭐</div><div style={{ fontSize: 12 }}>No favorites yet. Star bots you like.</div></div>
        : <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 8 }}>
          {favBots.map(bot => (
            <button key={bot.id} onClick={() => onSelectBot(bot)} style={{ background: C.s1, border: "1px solid " + C.border, borderRadius: 10, padding: 12, cursor: "pointer", textAlign: "left", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg," + C.accent + "30," + C.info + "30)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{bot.avatar}</div>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>{bot.name}</div><div style={{ fontSize: 10, color: C.t3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bot.tagline}</div></div>
            </button>
          ))}
        </div>}
      </div>
      <style>{MOBILE_VH_CSS}</style>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
    </div>
  );
}

/* ═══════════════════════════════════════
   ADMIN
   ═══════════════════════════════════════ */
function AdminPanel({ users, bots, onBanUser, onBack, mobile }) {
  return (
    <div style={{ minHeight: "100dvh", background: C.base, fontFamily: "'DM Sans', sans-serif", color: C.t1, padding: mobile ? 14 : 28 }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}><h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>⚡ Master Control</h2><Btn onClick={onBack} v="secondary" sx={{ padding: "6px 12px", fontSize: 11 }}>← Back</Btn></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>{[{ l: "Users", v: users.length, c: C.accent }, { l: "Bots", v: bots.length, c: C.info }, { l: "Likes", v: bots.reduce((s, b) => s + b.likes, 0), c: C.err }].map((s, i) => <div key={i} style={{ background: C.s2, border: "1px solid " + C.border, borderRadius: 10, padding: 10, textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700, color: s.c }}>{s.v}</div><div style={{ fontSize: 9, color: C.t3 }}>{s.l}</div></div>)}</div>
        <div style={{ background: C.s2, border: "1px solid " + C.border, borderRadius: 10, overflow: "hidden" }}>{users.length === 0 ? <div style={{ padding: 14, textAlign: "center", color: C.t3, fontSize: 12 }}>No users.</div> : users.map((u, i) => <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderBottom: i < users.length - 1 ? "1px solid " + C.border : "none" }}><div><span style={{ fontSize: 12, fontWeight: 600, color: u.banned ? C.err : C.t1 }}>{u.displayName}</span><span style={{ fontSize: 10, color: C.t3, marginLeft: 6 }}>@{u.username}</span></div><Btn onClick={() => onBanUser(u.username)} v={u.banned ? "primary" : "danger"} sx={{ padding: "4px 10px", fontSize: 10 }}>{u.banned ? "Unban" : "Ban"}</Btn></div>)}</div>
      </div>
      <style>{MOBILE_VH_CSS}</style>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
    </div>
  );
}

/* ═══════════════════════════════════════
   BUILDER — Chat sits between System and Export
   ═══════════════════════════════════════ */
function Builder({ formData, setFormData, botSettings, setBotSettings, llmConfig, setLlmConfig, onBack, onPublish, user, mobile }) {
  const [sec, setSec] = useState("identity");
  const [showPreview, setShowPreview] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showLLM, setShowLLM] = useState(false);
  const [showTemplates, setShowTemplates] = useState(true);
  const [previewFmt, setPFmt] = useState("markdown");
  const [copied, setCopied] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);

  const upd = useCallback((s, d) => { if (s === "settings") setBotSettings(d); else setFormData(p => ({ ...p, [s]: d })); }, [setFormData, setBotSettings]);
  const applyTpl = t => { const d = t.data; setFormData({ identity: d.identity || {}, personality: d.personality || {}, scenario: d.scenario || {}, dialogue: d.dialogue || {}, lorebook: d.lorebook || {}, system: d.system || {} }); setShowTemplates(false); setSec("identity"); setSideOpen(false); };

  const compiled = previewFmt === "markdown" ? compMD(formData) : compJSON(formData);
  const tok = Math.ceil(compiled.length / 3.8);
  const llmOn = !!(llmConfig.apiUrl);
  const cName = formData.identity?.name || "Untitled";
  const curData = sec === "settings" ? botSettings : (formData[sec] || {});
  const Comp = SEC_C[sec];

  const setV = v => { setShowTemplates(v === "tpl"); setShowPreview(v === "prev"); setShowChat(v === "chat"); setShowLLM(v === "llm"); setSideOpen(false); };
  const copy = () => { if (!botSettings.allowExport) return; navigator.clipboard.writeText(compiled).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };

  // Builder nav items — Chat sits above Export/Preview
  const navSections = [...SECTIONS, { id: "_chat", label: "Chat", icon: "💬" }, { id: "_llm", label: "LLM", icon: "🔌" }];

  const sideContent = <>
    <div style={{ padding: "12px 10px", borderBottom: "1px solid " + C.border, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div><div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>The Vault</div><div style={{ fontSize: 9, color: C.t3 }}>Builder v5</div></div>
      {mobile && <button onClick={() => setSideOpen(false)} style={{ background: "none", border: "none", color: C.t2, fontSize: 18, cursor: "pointer" }}>×</button>}
    </div>
    <div style={{ margin: "6px 6px 4px", padding: 8, background: C.s2, borderRadius: 8, border: "1px solid " + C.border }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.t1 }}>{cName}</div>
      <div style={{ fontSize: 9, color: C.t3 }}>~{tok} tok · {botSettings.isPublic ? "Public" : "Private"}</div>
    </div>
    <nav className="vault-scroll" style={{ flex: 1, padding: "2px 4px", overflowY: "auto" }}>
      {navSections.map(s => {
        const isChat = s.id === "_chat", isLLM = s.id === "_llm";
        const active = isChat ? showChat : isLLM ? showLLM : (sec === s.id && !showTemplates && !showPreview && !showChat && !showLLM);
        if (isChat || isLLM) {
          return <button key={s.id} onClick={() => setV(isChat ? "chat" : "llm")} style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "7px 8px", marginBottom: 1, background: active ? C.s3 : "transparent", border: active ? "1px solid " + C.border : "1px solid transparent", borderRadius: 6, color: active ? C.t1 : C.t2, cursor: "pointer", fontSize: 11, fontWeight: active ? 600 : 400, textAlign: "left", fontFamily: "inherit" }}><span style={{ fontSize: 12, width: 16, textAlign: "center" }}>{s.icon}</span><span style={{ flex: 1 }}>{s.label}</span>{isLLM && llmOn && <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.ok }} />}</button>;
        }
        if (s.id === "_chat") return <div key="div" style={{ height: 1, background: C.border, margin: "4px 2px" }} />;
        return <button key={s.id} onClick={() => { setSec(s.id); setV("editor"); }} style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "7px 8px", marginBottom: 1, background: active ? C.s3 : "transparent", border: active ? "1px solid " + C.border : "1px solid transparent", borderRadius: 6, color: active ? C.t1 : C.t2, cursor: "pointer", fontSize: 11, fontWeight: active ? 600 : 400, textAlign: "left", fontFamily: "inherit" }}><span style={{ fontSize: 12, width: 16, textAlign: "center" }}>{s.icon}</span><span style={{ flex: 1 }}>{s.label}</span></button>;
      })}
    </nav>
    <div style={{ padding: 8, borderTop: "1px solid " + C.border, display: "flex", flexDirection: "column", gap: 4 }}>
      <Btn onClick={onPublish} sx={{ width: "100%", padding: "7px 0", fontSize: 11 }}>Publish</Btn>
      <Btn onClick={() => setV("prev")} v="secondary" sx={{ width: "100%", padding: "6px 0", fontSize: 10 }}>Export</Btn>
      <Btn onClick={onBack} v="ghost" sx={{ width: "100%", padding: "5px 0", fontSize: 10, color: C.t3 }}>← Discover</Btn>
    </div>
  </>;

  const mNav = [{ id: "edit", icon: "📝", label: "Edit" }, { id: "chat", icon: "💬", label: "Chat" }, { id: "export", icon: "📤", label: "Export" }, { id: "home", icon: "🏠", label: "Home" }];

  return (
    <div style={{ display: "flex", height: "100dvh", width: "100%", background: C.base, color: C.t1, fontFamily: "'DM Sans', sans-serif", overflow: "hidden", position: "relative" }}>
      {mobile && sideOpen && <div onClick={() => setSideOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 90 }} />}
      <div style={{ width: mobile ? 220 : 190, minWidth: mobile ? 220 : 190, background: C.s1, borderRight: "1px solid " + C.border, display: "flex", flexDirection: "column", overflow: "hidden", ...(mobile ? { position: "fixed", left: sideOpen ? 0 : -240, top: 0, bottom: 0, zIndex: 100, transition: "left 0.2s ease" } : {}) }}>{sideContent}</div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", paddingBottom: mobile ? 56 : 0 }}>
        <div style={{ padding: mobile ? "7px 10px" : "7px 18px", borderBottom: "1px solid " + C.border, display: "flex", alignItems: "center", justifyContent: "space-between", background: C.s1, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {mobile && <button onClick={() => setSideOpen(true)} style={{ background: "none", border: "none", color: C.t1, fontSize: 16, cursor: "pointer" }}>☰</button>}
            <span style={{ color: C.t3, fontSize: 11 }}>{showPreview ? "Export" : showChat ? "Chat" : showLLM ? "LLM" : showTemplates ? "Templates" : SECTIONS.find(s => s.id === sec)?.label}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: llmOn ? C.ok : C.t3 }} /><span style={{ fontSize: 9, color: C.t3, fontFamily: "mono" }}>{tok}</span></div>
        </div>
        {/* Main content pane — overflow:auto for scroll */}
        <div style={{ flex: 1, minHeight: 0, overflowY: showChat ? "hidden" : "auto", padding: showChat ? 0 : (mobile ? 10 : 18), display: "flex", flexDirection: "column" }}>
          {showLLM ? (
            <div style={{ maxWidth: 560 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 12px" }}>🔌 LLM</h2>
              <div style={{ background: C.info + "10", border: "1px solid " + C.info + "25", borderRadius: 8, padding: 8, marginBottom: 12, fontSize: 10, color: C.t2 }}>🔒 Keys in-memory only.</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>{PRESETS.map(p => <button key={p.id} onClick={() => setLlmConfig(c => ({ ...c, preset: p.id, apiUrl: p.url, model: p.model }))} style={{ padding: "4px 9px", borderRadius: 6, fontSize: 10, fontWeight: 600, border: "1px solid " + (llmConfig.preset === p.id ? C.accent : C.border), background: llmConfig.preset === p.id ? C.glow : "transparent", color: llmConfig.preset === p.id ? C.accent : C.t2, cursor: "pointer", fontFamily: "inherit" }}>{p.name}</button>)}</div>
              <In label="API URL" value={llmConfig.apiUrl || ""} onChange={v => setLlmConfig(c => ({ ...c, apiUrl: v }))} placeholder="https://..." />
              <In label="Proxy URL" value={llmConfig.proxyUrl || ""} onChange={v => setLlmConfig(c => ({ ...c, proxyUrl: v }))} placeholder="Optional" />
              <div style={{ marginBottom: 14 }}><label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.t2, textTransform: "uppercase", marginBottom: 5 }}>API Key</label><input type="password" value={llmConfig.apiKey || ""} onChange={e => setLlmConfig(c => ({ ...c, apiKey: e.target.value }))} placeholder="sk-..." autoComplete="off" style={{ width: "100%", background: C.s3, border: "1.5px solid " + C.border, borderRadius: 8, color: C.t1, padding: "10px 12px", fontSize: 13, fontFamily: "mono", outline: "none", boxSizing: "border-box" }} /></div>
              <In label="Model" value={llmConfig.model || ""} onChange={v => setLlmConfig(c => ({ ...c, model: v }))} placeholder="gpt-4o" />
            </div>
          ) : showChat ? (
            <div style={{ flex: 1, minHeight: 0, padding: mobile ? 10 : 16, display: "flex", flexDirection: "column" }}>
              <ChatEngine formData={formData} llmConfig={llmConfig} charName={cName} mobile={mobile} userName={user.displayName || user.username} />
            </div>
          ) : showTemplates && !showPreview ? (
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 10px" }}>Templates</h2>
              <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 8 }}>{TEMPLATES.map((t, i) => <button key={i} onClick={() => applyTpl(t)} style={{ background: C.s2, border: "1px solid " + C.border, borderRadius: 10, padding: 10, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}><div style={{ fontSize: 12, fontWeight: 600, color: C.t1, marginBottom: 2 }}>{t.name}</div><div style={{ fontSize: 10, color: C.t2, marginBottom: 4 }}>{t.desc}</div><div style={{ display: "flex", gap: 3 }}>{t.tags.map((t2, j) => <Tag key={j} label={t2} ck={TK[j % 5]} />)}</div></button>)}</div>
            </div>
          ) : showPreview ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Export</h2>
                <div style={{ display: "flex", gap: 4 }}>{["markdown", "json"].map(f => <button key={f} onClick={() => setPFmt(f)} style={{ padding: "4px 8px", borderRadius: 5, fontSize: 10, fontWeight: 600, border: "1px solid " + (previewFmt === f ? C.accent : C.border), background: previewFmt === f ? C.glow : "transparent", color: previewFmt === f ? C.accent : C.t2, cursor: "pointer", fontFamily: "inherit" }}>{f === "markdown" ? "MD" : "JSON"}</button>)}{botSettings.allowExport ? <Btn onClick={copy} sx={{ padding: "4px 10px", fontSize: 10 }}>{copied ? "✓" : "Copy"}</Btn> : <span style={{ fontSize: 10, color: C.t3, padding: "4px 0" }}>Export off</span>}</div>
              </div>
              <pre style={{ background: C.s2, border: "1px solid " + C.border, borderRadius: 10, padding: mobile ? 10 : 16, fontSize: 11, fontFamily: "mono", color: C.t1, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word", overflowY: "auto", maxHeight: "calc(100dvh - 140px)" }}>{compiled || "Fill in sections."}</pre>
            </div>
          ) : (
            <div style={{ maxWidth: 560 }}><div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}><span style={{ fontSize: 16 }}>{SECTIONS.find(s => s.id === sec)?.icon}</span><h2 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{SECTIONS.find(s => s.id === sec)?.label}</h2></div><Comp data={curData} onChange={d => upd(sec, d)} /></div>
          )}
        </div>
      </div>
      {mobile && <BNav active={showChat ? "chat" : showPreview ? "export" : "edit"} onNav={id => { if (id === "edit") setSideOpen(true); if (id === "chat") setV("chat"); if (id === "export") setV("prev"); if (id === "home") onBack(); }} items={mNav} />}
      <style>{MOBILE_VH_CSS}</style>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
    </div>
  );
}

/* ═══════════════════════════════════════
   MAIN ORCHESTRATOR
   ═══════════════════════════════════════ */
export default function SuperPromptBuilder() {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [bots, setBots] = useState([...FEATURED]);
  const [view, setView] = useState("auth");
  const [selBot, setSelBot] = useState(null);
  const [fd, setFd] = useState({ identity: {}, personality: {}, scenario: {}, dialogue: {}, lorebook: {}, system: {} });
  const [bs, setBs] = useState({ ...DEF_SETTINGS });
  const [llm, setLlm] = useState({ preset: "custom", apiUrl: "", apiKey: "", proxyUrl: "", proxyKey: "", model: "", temperature: 0.85, maxTokens: 1024 });
  const [likedIds, setLikedIds] = useState(new Set());
  const mobile = useMobile();

  useEffect(() => {
    console.log("%cThe Vault%c by Khaoskami — MIT 2025", "font-weight:bold;color:#3B82F6;font-size:14px", "color:#8A95A8");
    if (typeof document !== "undefined") { let m = document.querySelector('meta[name="vault-origin"]'); if (!m) { m = document.createElement("meta"); m.name = "vault-origin"; document.head.appendChild(m); } m.content = "Khaoskami::the-vault::MIT-2025"; }
  }, []);

  const login = (u, isNew) => { if (u.banned) return; if (isNew) setUsers(p => [...p, u]); setUser(u); setView("discover"); };
  const logout = () => { setUser(null); setView("auth"); setLlm({ preset: "custom", apiUrl: "", apiKey: "", proxyUrl: "", proxyKey: "", model: "", temperature: 0.85, maxTokens: 1024 }); };
  const toggleFav = (botId) => { setUser(u => { const f = u.favorites || []; return { ...u, favorites: f.includes(botId) ? f.filter(x => x !== botId) : [...f, botId] }; }); };
  const toggleFollow = (cn) => { setUser(u => { const f = u.following || []; return { ...u, following: f.includes(cn) ? f.filter(x => x !== cn) : [...f, cn] }; }); };
  const toggleLike = (id) => { setLikedIds(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  const addComment = (botId, c) => { setBots(p => p.map(b => b.id === botId ? { ...b, comments: [...(b.comments || []), c] } : b)); if (selBot?.id === botId) setSelBot(b => ({ ...b, comments: [...(b.comments || []), c] })); };
  const publish = () => { const name = fd.identity?.name; if (!name) return; setBots(p => [{ id: uid(), name, tagline: fd.identity?.tagline || "", creator: user.displayName || user.username, tags: [], avatar: fd.identity?.avatar || "🤖", likes: 0, category: "Modern", comments: [], settings: { ...bs }, formData: { ...fd } }, ...p]); setView("discover"); };

  if (!user) return <AuthScreen onLogin={login} users={users} />;
  if (view === "admin" && user.isAdmin) return <AdminPanel users={users} bots={bots} onBanUser={un => setUsers(p => p.map(u => u.username === un ? { ...u, banned: !u.banned } : u))} onBack={() => setView("discover")} mobile={mobile} />;
  if (view === "favorites") return <FavoritesPage bots={bots} user={user} onSelectBot={b => { setSelBot(b); setView("botDetail"); }} onBack={() => setView("discover")} mobile={mobile} />;
  if (view === "botDetail" && selBot) { const live = bots.find(b => b.id === selBot.id) || selBot; return <BotPage bot={live} user={user} llmConfig={llm} onBack={() => { setSelBot(null); setView("discover"); }} onFollow={() => toggleFollow(live.creator)} isFollowing={(user.following || []).includes(live.creator)} onAddComment={c => addComment(live.id, c)} onToggleLike={() => toggleLike(live.id)} isLiked={likedIds.has(live.id)} onToggleFav={() => toggleFav(live.id)} isFav={(user.favorites || []).includes(live.id)} mobile={mobile} />; }
  if (view === "builder") return <Builder formData={fd} setFormData={setFd} botSettings={bs} setBotSettings={setBs} llmConfig={llm} setLlmConfig={setLlm} onBack={() => setView("discover")} onPublish={publish} user={user} mobile={mobile} />;
  return <DiscoverPage bots={bots} user={user} onSelectBot={b => { setSelBot(b); setView("botDetail"); }} onOpenBuilder={() => { setFd({ identity: {}, personality: {}, scenario: {}, dialogue: {}, lorebook: {}, system: {} }); setBs({ ...DEF_SETTINGS }); setView("builder"); }} onLogout={logout} onAdmin={() => setView("admin")} onFavorites={() => setView("favorites")} mobile={mobile} />;
}
