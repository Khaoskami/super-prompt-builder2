import { useState, useRef, useCallback } from "react";

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
      border: `1px solid ${c}30`,
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
          border: `1.5px solid ${focused ? COLORS.accent : COLORS.border}`,
          borderRadius: 8,
          color: COLORS.textPrimary,
          padding: "10px 12px",
          fontSize: 13,
          fontFamily: "'JetBrains Mono', monospace",
          lineHeight: 1.6,
          resize: "vertical",
          outline: "none",
          transition: "border-color 0.2s, box-shadow 0.2s",
          boxShadow: focused ? `0 0 0 3px ${COLORS.accentGlow}` : "none",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

function InputField({ value, onChange, placeholder, label }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
          {label}
        </label>
      )}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        style={{
          width: "100%",
          background: COLORS.surface3,
          border: `1.5px solid ${focused ? COLORS.accent : COLORS.border}`,
          borderRadius: 8,
          color: COLORS.textPrimary,
          padding: "10px 12px",
          fontSize: 13,
          fontFamily: "inherit",
          outline: "none",
          transition: "border-color 0.2s, box-shadow 0.2s",
          boxShadow: focused ? `0 0 0 3px ${COLORS.accentGlow}` : "none",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

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
      <TextArea label="Example Dialogue" hint="{{char}} and {{user}} exchanges that establish voice and tone. Use the format shown." placeholder={`{{char}}: "Dialogue here." *Action description.*\n{{user}}: "Response."\n{{char}}: "Reply." *Further action.*`} value={data.examples || ""} onChange={(v) => update("examples", v)} rows={12} />
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
          border: `1px solid ${COLORS.border}`,
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
          <InputField label={`Entry ${i + 1} — Keywords`} placeholder="comma,separated,triggers" value={entry.keyword} onChange={(v) => updateEntry(i, "keyword", v)} />
          <TextArea label="Content" placeholder="What the AI should know when these keywords appear..." value={entry.content} onChange={(v) => updateEntry(i, "content", v)} rows={3} />
        </div>
      ))}
      <button onClick={addEntry} style={{
        width: "100%", padding: "10px 0",
        background: COLORS.accentGlow, border: `1.5px dashed ${COLORS.accent}`,
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
      <TextArea label="System Rules" hint="Hard constraints the AI must follow." placeholder={`e.g.\n- Never break character\n- Combat has real consequences\n- {{user}} actions are never assumed\n- Pacing: slow-burn, not rushed`} value={data.rules || ""} onChange={(v) => update("rules", v)} rows={6} />
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

function compilePrompt(formData) {
  const lines = [];
  const { identity = {}, personality = {}, scenario = {}, dialogue = {}, lorebook = {}, system = {} } = formData;

  if (identity.name) lines.push(`# ${identity.name}`);
  if (identity.tagline) lines.push(`*${identity.tagline}*\n`);
  
  if (identity.description) {
    lines.push(`## Description`);
    lines.push(identity.description + "\n");
  }

  const hasPersonality = personality.traits || personality.speech || personality.quirks || personality.backstory;
  if (hasPersonality) {
    lines.push(`## Personality`);
    if (personality.traits) lines.push(`**Traits:** ${personality.traits}`);
    if (personality.speech) lines.push(`**Speech:** ${personality.speech}`);
    if (personality.quirks) lines.push(`**Quirks:** ${personality.quirks}`);
    if (personality.backstory) lines.push(`**Backstory:** ${personality.backstory}`);
    lines.push("");
  }

  const hasScenario = scenario.setting || scenario.role || scenario.goal;
  if (hasScenario) {
    lines.push(`## Scenario`);
    if (scenario.setting) lines.push(`**Setting:** ${scenario.setting}`);
    if (scenario.role) lines.push(`**User Role:** ${scenario.role}`);
    if (scenario.goal) lines.push(`**Goal:** ${scenario.goal}`);
    lines.push("");
  }

  if (scenario.firstMessage) {
    lines.push(`## First Message`);
    lines.push(scenario.firstMessage + "\n");
  }

  if (dialogue.examples) {
    lines.push(`## Example Dialogue`);
    lines.push(dialogue.examples + "\n");
  }

  const entries = lorebook.entries || [];
  const filledEntries = entries.filter(e => e.keyword && e.content);
  if (filledEntries.length > 0) {
    lines.push(`## Lorebook`);
    filledEntries.forEach((e) => {
      lines.push(`**[${e.keyword}]:** ${e.content}`);
    });
    lines.push("");
  }

  const hasSys = system.rules || system.authorsNote || system.postHistory;
  if (hasSys) {
    lines.push(`## System`);
    if (system.rules) lines.push(`**Rules:**\n${system.rules}`);
    if (system.authorsNote) lines.push(`\n**Author's Note:** ${system.authorsNote}`);
    if (system.postHistory) lines.push(`\n**Post-History:** ${system.postHistory}`);
  }

  return lines.join("\n");
}

function compileJSON(formData) {
  const { identity = {}, personality = {}, scenario = {}, dialogue = {}, lorebook = {}, system = {} } = formData;
  const obj = {
    name: identity.name || "",
    description: identity.description || "",
    personality: [personality.traits, personality.speech, personality.quirks, personality.backstory].filter(Boolean).join("\n\n"),
    scenario: [scenario.setting, scenario.role && `User Role: ${scenario.role}`, scenario.goal && `Goal: ${scenario.goal}`].filter(Boolean).join("\n\n"),
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
    },
  };
  return JSON.stringify(obj, null, 2);
}

export default function SuperPromptBuilder() {
  const [activeSection, setActiveSection] = useState("identity");
  const [formData, setFormData] = useState({
    identity: {}, personality: {}, scenario: {}, dialogue: {}, lorebook: {}, system: {},
  });
  const [showPreview, setShowPreview] = useState(false);
  const [previewFormat, setPreviewFormat] = useState("markdown");
  const [copied, setCopied] = useState(false);
  const [showTemplates, setShowTemplates] = useState(true);

  const updateSection = useCallback((section, data) => {
    setFormData((prev) => ({ ...prev, [section]: data }));
  }, []);

  const applyTemplate = (template) => {
    const d = template.data;
    setFormData({
      identity: d.identity || {},
      personality: d.personality || {},
      scenario: d.scenario || {},
      dialogue: d.dialogue || {},
      lorebook: d.lorebook || {},
      system: d.system || {},
    });
    setShowTemplates(false);
    setActiveSection("identity");
  };

  const compiled = previewFormat === "markdown" ? compilePrompt(formData) : compileJSON(formData);
  const totalTokens = Math.ceil(compiled.length / 3.8);

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
  };

  const ActiveComponent = SECTION_COMPONENTS[activeSection];
  const charName = formData.identity?.name || "Untitled";

  return (
    <div style={{
      display: "flex",
      height: "100vh",
      width: "100%",
      background: COLORS.base,
      color: COLORS.textPrimary,
      fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
      overflow: "hidden",
    }}>
      {/* ── SIDEBAR ── */}
      <div style={{
        width: 220,
        minWidth: 220,
        background: COLORS.surface1,
        borderRight: `1px solid ${COLORS.border}`,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Logo area */}
        <div style={{
          padding: "20px 16px 16px",
          borderBottom: `1px solid ${COLORS.border}`,
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.textPrimary, letterSpacing: "-0.01em" }}>
            Super Prompt
          </div>
          <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>Builder v1.0</div>
        </div>

        {/* Character card mini */}
        <div style={{
          margin: "12px 12px 8px",
          padding: "12px",
          background: COLORS.surface2,
          borderRadius: 8,
          border: `1px solid ${COLORS.border}`,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 8,
            background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.info})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, marginBottom: 8,
          }}>
            {charName[0]?.toUpperCase() || "?"}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 2 }}>
            {charName}
          </div>
          <div style={{ fontSize: 11, color: COLORS.textMuted }}>
            ~{totalTokens} tokens total
          </div>
        </div>

        {/* Section nav */}
        <nav style={{ flex: 1, padding: "4px 8px", overflowY: "auto" }}>
          {SECTIONS.map((s) => {
            const active = activeSection === s.id;
            const sectionData = formData[s.id] || {};
            const hasContent = Object.values(sectionData).some(v =>
              typeof v === "string" ? v.trim() : Array.isArray(v) ? v.length > 0 : false
            );
            return (
              <button
                key={s.id}
                onClick={() => { setActiveSection(s.id); setShowTemplates(false); setShowPreview(false); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "9px 12px",
                  marginBottom: 2,
                  background: active ? COLORS.surface3 : "transparent",
                  border: active ? `1px solid ${COLORS.border}` : "1px solid transparent",
                  borderRadius: 6,
                  color: active ? COLORS.textPrimary : COLORS.textSecondary,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  textAlign: "left",
                  transition: "all 0.15s",
                  fontFamily: "inherit",
                }}
              >
                <span style={{ fontSize: 15, width: 20, textAlign: "center" }}>{s.icon}</span>
                <span style={{ flex: 1 }}>{s.label}</span>
                {hasContent && (
                  <span style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: COLORS.success,
                  }} />
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div style={{ padding: "12px", borderTop: `1px solid ${COLORS.border}`, display: "flex", flexDirection: "column", gap: 6 }}>
          <button
            onClick={() => { setShowPreview(true); setShowTemplates(false); }}
            style={{
              padding: "9px 0", borderRadius: 6, border: "none",
              background: COLORS.accent, color: "#fff",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
              fontFamily: "inherit",
              transition: "background 0.15s",
            }}
          >
            Preview & Export
          </button>
          <button
            onClick={handleReset}
            style={{
              padding: "8px 0", borderRadius: 6,
              border: `1px solid ${COLORS.border}`, background: "transparent",
              color: COLORS.textSecondary, fontSize: 12, cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Reset All
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top bar */}
        <div style={{
          padding: "12px 24px",
          borderBottom: `1px solid ${COLORS.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: COLORS.surface1,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => setShowTemplates(true)}
              style={{
                padding: "6px 14px", borderRadius: 6,
                border: `1px solid ${showTemplates ? COLORS.accent : COLORS.border}`,
                background: showTemplates ? COLORS.accentGlow : "transparent",
                color: showTemplates ? COLORS.accent : COLORS.textSecondary,
                fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Templates
            </button>
            <span style={{ color: COLORS.textMuted, fontSize: 12 }}>
              {showPreview ? "Preview" : showTemplates ? "Choose a starting point" : `Editing → ${SECTIONS.find(s => s.id === activeSection)?.label}`}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{
              fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
              color: totalTokens > 4000 ? COLORS.danger : totalTokens > 2500 ? COLORS.warning : COLORS.textMuted,
            }}>
              {totalTokens} tokens
            </span>
            {totalTokens > 4000 && (
              <span style={{ fontSize: 11, color: COLORS.danger, fontWeight: 600 }}>HIGH</span>
            )}
          </div>
        </div>

        {/* Content area */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
          {showTemplates && !showPreview ? (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: COLORS.textPrimary, margin: "0 0 4px 0" }}>
                Start with a template
              </h2>
              <p style={{ fontSize: 13, color: COLORS.textSecondary, margin: "0 0 20px 0" }}>
                Pre-structured foundations. Pick one, then make it yours.
              </p>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 12,
              }}>
                {TEMPLATES.map((t, i) => (
                  <button
                    key={i}
                    onClick={() => applyTemplate(t)}
                    style={{
                      background: COLORS.surface2,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 10,
                      padding: "16px",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "border-color 0.2s, transform 0.15s",
                      fontFamily: "inherit",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = COLORS.accent;
                      e.currentTarget.style.transform = "translateY(-2px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = COLORS.border;
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 4 }}>
                      {t.name}
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 10, lineHeight: 1.4 }}>
                      {t.desc}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {t.tags.map((tag, j) => (
                        <Tag key={j} label={tag} colorKey={TAG_COLORS[j % TAG_COLORS.length]} />
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : showPreview ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: COLORS.textPrimary, margin: 0 }}>
                  Compiled Output
                </h2>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    onClick={() => setPreviewFormat("markdown")}
                    style={{
                      padding: "5px 12px", borderRadius: 5, fontSize: 12, fontWeight: 600,
                      border: `1px solid ${previewFormat === "markdown" ? COLORS.accent : COLORS.border}`,
                      background: previewFormat === "markdown" ? COLORS.accentGlow : "transparent",
                      color: previewFormat === "markdown" ? COLORS.accent : COLORS.textSecondary,
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    Markdown
                  </button>
                  <button
                    onClick={() => setPreviewFormat("json")}
                    style={{
                      padding: "5px 12px", borderRadius: 5, fontSize: 12, fontWeight: 600,
                      border: `1px solid ${previewFormat === "json" ? COLORS.accent : COLORS.border}`,
                      background: previewFormat === "json" ? COLORS.accentGlow : "transparent",
                      color: previewFormat === "json" ? COLORS.accent : COLORS.textSecondary,
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    JSON (Tavern)
                  </button>
                  <button
                    onClick={handleCopy}
                    style={{
                      padding: "5px 14px", borderRadius: 5, fontSize: 12, fontWeight: 600,
                      border: "none",
                      background: copied ? COLORS.success : COLORS.accent,
                      color: "#fff",
                      cursor: "pointer", fontFamily: "inherit",
                      transition: "background 0.2s",
                      minWidth: 80,
                    }}
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
              <pre style={{
                background: COLORS.surface2,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 10,
                padding: 20,
                fontSize: 12,
                fontFamily: "'JetBrains Mono', monospace",
                color: COLORS.textPrimary,
                lineHeight: 1.7,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                overflowY: "auto",
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
              <ActiveComponent
                data={formData[activeSection] || {}}
                onChange={(data) => updateSection(activeSection, data)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Google Fonts */}
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
    </div>
  );
}
