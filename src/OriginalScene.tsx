import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { AnimatedTopDock, type BubbleCounts } from "./shaders/animated-top-dock/AnimatedTopDock";
import { appendNoteToHistory, filterNotes, MAX_NOTES, parseNoteInput, readAllNotes, subscribeNoteHistory, type NoteRecord, type NoteTypeFilter } from "./noteHistory";
import { NoteClassificationEditor } from "./NoteClassificationEditor";
import { CardsScene } from "./CardsScene";
import "@designcodeio/threeui/style.css";
import "./app.css";

const BUBBLE_COUNTS_KEY = "one-tap-note.bubble-counts";
const PLANET_KEY = "one-tap-note.card-planet";
const EarthGlobe = lazy(() => import("./EarthGlobe").then(({ EarthGlobe }) => ({ default: EarthGlobe })));
const SaturnGlobe = lazy(() => import("./SaturnGlobe").then(({ SaturnGlobe }) => ({ default: SaturnGlobe })));
const MoonGlobe = lazy(() => import("./MoonGlobe").then(({ MoonGlobe }) => ({ default: MoonGlobe })));
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

function loadSavedNotes(): NoteRecord[] { return readAllNotes(); }

function readSelectedNoteType(): NoteTypeFilter {
  try {
    const saved = localStorage.getItem("one-tap-note.note-type");
    return saved === "urgent" || saved === "memo" ? saved : "all";
  }
  catch { return "all"; }
}

type CelestialBody = "earth" | "saturn" | "moon";

function readPlanet(): CelestialBody {
  try {
    const saved = localStorage.getItem(PLANET_KEY);
    return saved === "saturn" || saved === "moon" ? saved : "earth";
  }
  catch { return "earth"; }
}

export function OriginalScene() {
  const [cardStyle, setCardStyle] = useState(() => window.location.pathname === "/cards" || new URLSearchParams(window.location.search).get("style") === "cards");
  const [selectedNote, setSelectedNote] = useState<NoteRecord | null>(null);
  const [savedNotes, setSavedNotes] = useState<NoteRecord[]>(loadSavedNotes);
  const noteCount = savedNotes.length;
  const [noteText, setNoteText] = useState("");
  const [noteStatus, setNoteStatus] = useState("");
  const [bubbleCounts, setBubbleCounts] = useState<BubbleCounts>(readBubbleCounts);
  const [bubbleConfigOpen, setBubbleConfigOpen] = useState(false);
  const [planet] = useState<CelestialBody>(readPlanet);
  const [noteType, setNoteType] = useState<NoteTypeFilter>(readSelectedNoteType);
  const visibleBubbleNotes = filterNotes(savedNotes, noteType, null).slice(0, MAX_NOTES);
  const parsedInput = parseNoteInput(noteText);
  const inputNoteType = parsedInput.noteType ?? (noteType === "all" ? "memo" : noteType);
  const renderedBubbleCounts = useMemo(() => {
    const carriers = bubbleCounts.large + bubbleCounts.medium;
    const missing = Math.max(0, visibleBubbleNotes.length - carriers);
    // Decorative bubbles never count as note carriers; grow readable bubbles.
    return { ...bubbleCounts, large: bubbleCounts.large + Math.floor(missing / 2), medium: bubbleCounts.medium + Math.ceil(missing / 2) };
  }, [bubbleCounts, visibleBubbleNotes.length]);

  useEffect(() => {
    setSelectedNote(null);
  }, [cardStyle]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setSelectedNote(null); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, []);

  useEffect(() => {
    const refreshSavedNotes = () => {
      const next = loadSavedNotes();
      setSavedNotes(next);
      setSelectedNote((current) => current ? next.find((note) => note.id === current.id) ?? null : null);
    };
    return subscribeNoteHistory(refreshSavedNotes);
  }, []);

  useEffect(() => {
    const syncStyleFromLocation = () => setCardStyle(window.location.pathname === "/cards" || new URLSearchParams(window.location.search).get("style") === "cards");
    window.addEventListener("popstate", syncStyleFromLocation);
    return () => window.removeEventListener("popstate", syncStyleFromLocation);
  }, []);

  const selectPageStyle = (nextCardStyle: boolean) => {
    setCardStyle(nextCardStyle);
    const nextPath = nextCardStyle ? "/cards" : "/";
    if (window.location.pathname !== nextPath || window.location.search) {
      window.history.pushState({}, "", nextPath);
    }
  };

  const selectNoteType = (next: NoteTypeFilter) => {
    setNoteType(next);
    setSelectedNote(null);
    setNoteStatus("");
    try { localStorage.setItem("one-tap-note.note-type", next); } catch { /* Selection remains available for this session. */ }
  };

  const saveNote = () => {
    const { text, category, noteType: detectedType } = parseNoteInput(noteText);
    const savedType = detectedType ?? (noteType === "all" ? "memo" : noteType);
    if (!text) return;
    const firstSentence = text.split(/[。！？!?.\n]/, 1)[0].trim();
    const title = Array.from(firstSentence).slice(0, 12).join("") || "随手记";
    const result = appendNoteToHistory({ title, text, noteType: savedType, category });
    if (result !== "saved") {
      setSavedNotes(readAllNotes());
      setNoteStatus(result === "full" ? "已达到 10 条记事上限，删除一张卡片后可继续记录。" : "保存失败，请检查浏览器存储后重试。");
      return;
    }
    const next = readAllNotes();
    setSavedNotes(next);
    selectNoteType(noteType === "all" ? "all" : savedType);
    setNoteText("");
    setNoteStatus(`已保存到${savedType === "urgent" ? "急事" : "备忘"}${category ? ` · ${category}` : ""}`);
    try { localStorage.setItem("one-tap-note.titles", JSON.stringify(next.slice(0, 3))); } catch { /* Keep the note available in the current page. */ }
  };

  const adjustBubbleCount = (category: keyof BubbleCounts, amount: number) => {
    const total = Object.values(bubbleCounts).reduce((sum, value) => sum + value, 0);
    const nextValue = bubbleCounts[category] + amount;
    if (nextValue < 0 || (amount > 0 && total >= MAX_BUBBLES)) return;
    const next = { ...bubbleCounts, [category]: nextValue };
    setBubbleCounts(next);
    try { localStorage.setItem(BUBBLE_COUNTS_KEY, JSON.stringify(next)); } catch { /* Keep this page interactive for the current session. */ }
  };

  return <div className={`original-page${cardStyle ? " is-card-mode" : ""}`}>
    <div className="shader-frame">
      <AnimatedTopDock
        variant="glass"
        disablePointerMotion
        particles={cardStyle ? 0 : Object.values(renderedBubbleCounts).reduce((sum, value) => sum + value, 0)}
        thickness={0.115}
        dispersion={0.050}
        specular={0.85}
        rim={0.50}
        drift={1.00}
        proximity={44}
        heightGrowth={0}
        drop={0}
        glassTitles={cardStyle ? [] : visibleBubbleNotes.map((note) => note.title)}
        glassNotes={cardStyle ? [] : visibleBubbleNotes}
        onGlassNoteSelect={(note) => setSelectedNote(visibleBubbleNotes.find((record) => record === note) ?? null)}
        bubbleCounts={cardStyle ? { large: 0, medium: 0, small: 0, micro: 0 } : renderedBubbleCounts}
      />
    </div>

    <div className="page-switch-toolbar">
      <div className="planet-switch page-style-switch" role="group" aria-label="页面样式">
        <button className={cardStyle ? "" : "is-selected"} type="button" aria-pressed={!cardStyle} onClick={() => selectPageStyle(false)}>泡泡</button>
        <button className={cardStyle ? "is-selected" : ""} type="button" aria-pressed={cardStyle} onClick={() => selectPageStyle(true)}>卡片</button>
      </div>
      <div className="planet-switch note-type-switch" role="group" aria-label="记事类型">
        <button type="button" className={noteType === "all" ? "is-selected" : ""} aria-pressed={noteType === "all"} onClick={() => selectNoteType("all")}>全部</button>
        <button type="button" className={noteType === "urgent" ? "is-selected" : ""} aria-pressed={noteType === "urgent"} onClick={() => selectNoteType("urgent")}>急事</button>
        <button type="button" className={noteType === "memo" ? "is-selected" : ""} aria-pressed={noteType === "memo"} onClick={() => selectNoteType("memo")}>备忘</button>
      </div>
    </div>

    {cardStyle && <>
      <div className="page-side-glass" aria-hidden="true" />
      <Suspense fallback={null}>{planet === "earth" ? <EarthGlobe /> : planet === "saturn" ? <SaturnGlobe /> : <MoonGlobe />}</Suspense>
      <div className="page-time-eye">
        <img src="/images/star-window.png" alt="时光之眼" draggable={false} />
        <span className="page-time-eye__name" aria-hidden="true">时光之眼</span>
      </div>
      <div className={`card-capacity${noteCount >= MAX_NOTES ? " is-full" : ""}`} role="status" aria-label={`卡片容量：已用 ${noteCount} 条，上限 ${MAX_NOTES} 条`} title={noteCount >= MAX_NOTES ? "容量已满，删除卡片后可继续记录" : "最多保存 10 条记事"}>
        <div className="card-capacity__label"><strong>{noteCount}<small> / {MAX_NOTES}</small></strong></div>
        <div className="card-capacity__slots" aria-hidden="true">{Array.from({ length: MAX_NOTES }, (_, index) => <i key={index} className={index < noteCount ? "is-used" : ""} />)}</div>
      </div>
      <CardsScene embedded noteType={noteType} />
    </>}

    {!cardStyle && <div className="original-page__actions">
      <button className="bubble-config-trigger" type="button" aria-label="泡泡配置" title="泡泡配置" onClick={() => setBubbleConfigOpen(true)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z"/><path d="m19.3 13.4 1.1.9-1.5 2.6-1.4-.5a7.9 7.9 0 0 1-1.5.9l-.2 1.5h-3l-.3-1.5a7.9 7.9 0 0 1-1.5-.9l-1.4.5-1.5-2.6 1.1-.9a7 7 0 0 1 0-1.8l-1.1-.9 1.5-2.6 1.4.5a7.9 7.9 0 0 1 1.5-.9l.3-1.5h3l.2 1.5a7.9 7.9 0 0 1 1.5.9l1.4-.5 1.5 2.6-1.1.9a7 7 0 0 1 0 1.8Z"/></svg>
      </button>
    </div>}

    {!cardStyle && bubbleConfigOpen && <div className="bubble-config-backdrop" onClick={() => setBubbleConfigOpen(false)}>
      <section className="bubble-config" role="dialog" aria-modal="true" aria-labelledby="original-bubble-config-title" onClick={(event) => event.stopPropagation()}>
        <div className="bubble-config__header">
          <div><span>原始页面</span><h2 id="original-bubble-config-title">泡泡配置</h2></div>
          <button className="bubble-config__close" type="button" aria-label="关闭" onClick={() => setBubbleConfigOpen(false)}>×</button>
        </div>
        <p className="bubble-config__summary">设置基础泡泡数量。记事只放入大、中泡泡，不足时自动补充；小、微泡泡仅作装饰。</p>
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
        <div className="bubble-config__footer"><span>基础总数</span><strong>{Object.values(bubbleCounts).reduce((sum, value) => sum + value, 0)} <small>/ {MAX_BUBBLES}</small></strong></div>
      </section>
    </div>}
    <section className="composer original-page__composer" id="note-composer" aria-label="输入记录">
      <textarea aria-label="记录内容" placeholder="急事：今天交文件；备忘：周末买牛奶。也可用 #工作 归类" value={noteText} onChange={(event) => setNoteText(event.target.value)} />
      <div className="composer-actions">
        <span className="original-page__input-hint" aria-live="polite">{parsedInput.noteType ? "识别为" : "记入"}{inputNoteType === "urgent" ? "急事" : "备忘"}{parsedInput.category ? ` · ${parsedInput.category}` : ""}</span>
        <div className="composer-buttons">
          <button className="done-button" type="button" disabled={!parsedInput.text} onClick={saveNote}>记好了</button>
        </div>
      </div>
      {noteStatus && <p className="note-status" role="status">{noteStatus}</p>}
    </section>

    {selectedNote && <div className="note-detail-backdrop" onClick={() => setSelectedNote(null)}>
      <section className="note-detail" role="dialog" aria-modal="true" aria-labelledby="original-note-title" onClick={(event) => event.stopPropagation()}>
        <div className="note-detail__topline"><span>完整记录</span><button type="button" aria-label="关闭" onClick={() => setSelectedNote(null)}>×</button></div>
        <h2 id="original-note-title">{selectedNote.title}</h2><p>{selectedNote.text}</p>
        <NoteClassificationEditor key={selectedNote.id} note={selectedNote} onSaved={() => { setSelectedNote(null); setNoteStatus("记事类型已更新"); }} />
      </section>
    </div>}
  </div>;
}
