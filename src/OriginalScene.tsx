import { useState } from "react";
import { AnimatedTopDock, type BubbleCounts, type GlassNote } from "./shaders/animated-top-dock/AnimatedTopDock";
import "@designcodeio/threeui/style.css";
import "./app.css";

const BUBBLE_COUNTS_KEY = "one-tap-note.bubble-counts";
const MAX_BUBBLES = 34;
const DEFAULT_BUBBLE_COUNTS: BubbleCounts = { large: 4, medium: 5, small: 5, micro: 5 };
const BUBBLE_CATEGORIES: Array<{ key: keyof BubbleCounts; label: string; sizeClass: string }> = [
  { key: "large", label: "大泡泡", sizeClass: "large" },
  { key: "medium", label: "中泡泡", sizeClass: "medium" },
  { key: "small", label: "小泡泡", sizeClass: "small" },
  { key: "micro", label: "微泡泡", sizeClass: "micro" },
];

function readBubbleCounts(): BubbleCounts {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(BUBBLE_COUNTS_KEY) ?? "null");
    if (!saved || typeof saved !== "object") return DEFAULT_BUBBLE_COUNTS;
    const raw = saved as Partial<BubbleCounts>;
    let remaining = MAX_BUBBLES;
    const result: BubbleCounts = { large: 0, medium: 0, small: 0, micro: 0 };
    for (const key of ["large", "medium", "small", "micro"] as const) {
      result[key] = Math.min(remaining, Math.max(0, Math.floor(Number(raw[key]) || 0)));
      remaining -= result[key];
    }
    return result;
  } catch {
    return DEFAULT_BUBBLE_COUNTS;
  }
}

function loadSavedNotes(): GlassNote[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem("one-tap-note.titles") ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is GlassNote => Boolean(item && typeof item.title === "string" && typeof item.text === "string")).slice(0, 3) : [];
  } catch {
    return [];
  }
}

export function OriginalScene() {
  const [selectedNote, setSelectedNote] = useState<GlassNote | null>(null);
  const [savedNotes, setSavedNotes] = useState<GlassNote[]>(loadSavedNotes);
  const [noteText, setNoteText] = useState("");
  const [noteStatus, setNoteStatus] = useState("");
  const [bubbleCounts, setBubbleCounts] = useState<BubbleCounts>(readBubbleCounts);
  const [bubbleConfigOpen, setBubbleConfigOpen] = useState(false);

  const saveNote = () => {
    const text = noteText.trim();
    if (!text) return;
    const firstSentence = text.split(/[。！？!?.\n]/, 1)[0].trim();
    const title = Array.from(firstSentence).slice(0, 12).join("") || "随手记";
    const next = [{ title, text }, ...savedNotes].slice(0, 3);
    setSavedNotes(next);
    setNoteText("");
    setNoteStatus("已保存到泡泡中");
    try { localStorage.setItem("one-tap-note.titles", JSON.stringify(next)); } catch { /* Keep the note available in the current page. */ }
  };

  const adjustBubbleCount = (category: keyof BubbleCounts, amount: number) => {
    const total = Object.values(bubbleCounts).reduce((sum, value) => sum + value, 0);
    const nextValue = bubbleCounts[category] + amount;
    if (nextValue < 0 || (amount > 0 && total >= MAX_BUBBLES)) return;
    const next = { ...bubbleCounts, [category]: nextValue };
    setBubbleCounts(next);
    try { localStorage.setItem(BUBBLE_COUNTS_KEY, JSON.stringify(next)); } catch { /* Keep this page interactive for the current session. */ }
  };

  return <div className="original-page">
    <div className="shader-frame">
      <AnimatedTopDock
        variant="glass"
        disablePointerMotion
        particles={Object.values(bubbleCounts).reduce((sum, value) => sum + value, 0)}
        thickness={0.115}
        dispersion={0.050}
        specular={0.85}
        rim={0.50}
        drift={1.00}
        proximity={44}
        heightGrowth={0}
        drop={0}
        glassTitles={savedNotes.map((note) => note.title)}
        glassNotes={savedNotes}
        onGlassNoteSelect={setSelectedNote}
        bubbleCounts={bubbleCounts}
      />
    </div>

    <div className="original-page__actions">
      <button className="bubble-config-trigger" type="button" aria-label="泡泡配置" title="泡泡配置" onClick={() => setBubbleConfigOpen(true)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z"/><path d="m19.3 13.4 1.1.9-1.5 2.6-1.4-.5a7.9 7.9 0 0 1-1.5.9l-.2 1.5h-3l-.3-1.5a7.9 7.9 0 0 1-1.5-.9l-1.4.5-1.5-2.6 1.1-.9a7 7 0 0 1 0-1.8l-1.1-.9 1.5-2.6 1.4.5a7.9 7.9 0 0 1 1.5-.9l.3-1.5h3l.2 1.5a7.9 7.9 0 0 1 1.5.9l1.4-.5 1.5 2.6-1.1.9a7 7 0 0 1 0 1.8Z"/></svg>
      </button>
    </div>

    {bubbleConfigOpen && <div className="bubble-config-backdrop" onClick={() => setBubbleConfigOpen(false)}>
      <section className="bubble-config" role="dialog" aria-modal="true" aria-labelledby="original-bubble-config-title" onClick={(event) => event.stopPropagation()}>
        <div className="bubble-config__header">
          <div><span>原始页面</span><h2 id="original-bubble-config-title">泡泡配置</h2></div>
          <button className="bubble-config__close" type="button" aria-label="关闭" onClick={() => setBubbleConfigOpen(false)}>×</button>
        </div>
        <p className="bubble-config__summary">设置背景中每种尺寸的泡泡数量。调整后立即生效。</p>
        <div className="bubble-config__rows">
          {BUBBLE_CATEGORIES.map(({ key, label, sizeClass }) => (
            <div className="bubble-config__row" key={key}>
              <span className={`bubble-config__sample is-${sizeClass}`} aria-hidden="true" />
              <span className="bubble-config__label">{label}</span>
              <div className="bubble-config__stepper">
                <button type="button" aria-label={`${label}减一`} disabled={bubbleCounts[key] === 0} onClick={() => adjustBubbleCount(key, -1)}>−</button>
                <output aria-label={`${label}数量`}>{bubbleCounts[key]}</output>
                <button type="button" aria-label={`${label}加一`} disabled={Object.values(bubbleCounts).reduce((sum, value) => sum + value, 0) >= MAX_BUBBLES} onClick={() => adjustBubbleCount(key, 1)}>+</button>
              </div>
            </div>
          ))}
        </div>
        <div className="bubble-config__footer"><span>总数</span><strong>{Object.values(bubbleCounts).reduce((sum, value) => sum + value, 0)} <small>/ {MAX_BUBBLES}</small></strong></div>
      </section>
    </div>}
    <section className="composer original-page__composer" aria-label="输入记录">
      <textarea aria-label="记录内容" placeholder="有什么想记下的？" value={noteText} onChange={(event) => setNoteText(event.target.value)} />
      <div className="composer-actions">
        <span className="original-page__input-hint">随时记下这一刻</span>
        <div className="composer-buttons">
          <button className="done-button" type="button" disabled={!noteText.trim()} onClick={saveNote}>记好了</button>
        </div>
      </div>
      {noteStatus && <p className="note-status" role="status">{noteStatus}</p>}
    </section>

    {selectedNote && <div className="note-detail-backdrop" onClick={() => setSelectedNote(null)}>
      <section className="note-detail" role="dialog" aria-modal="true" aria-labelledby="original-note-title" onClick={(event) => event.stopPropagation()}>
        <div className="note-detail__topline"><span>完整记录</span><button type="button" aria-label="关闭" onClick={() => setSelectedNote(null)}>×</button></div>
        <h2 id="original-note-title">{selectedNote.title}</h2><p>{selectedNote.text}</p>
      </section>
    </div>}
  </div>;
}
