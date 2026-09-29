import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { AnimatedTopDock, type BubbleCounts, type GlassNote } from "./shaders/animated-top-dock/AnimatedTopDock";
import "@designcodeio/threeui/style.css";
import "./app.css";

type RecognitionResultEvent = {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
};

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onstart: (() => void) | null;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type RecognitionConstructor = new () => Recognition;
type VisualStyle = "aurora" | "mint" | "dusk";

const TITLES_KEY = "one-tap-note.titles";
const BUBBLE_COUNTS_KEY = "one-tap-note.bubble-counts";
const MAX_BUBBLES = 34;
const DEFAULT_BUBBLE_COUNTS: BubbleCounts = { large: 4, medium: 5, small: 5, micro: 5 };
const BUBBLE_CATEGORIES: Array<{ key: keyof BubbleCounts; label: string; sizeClass: string }> = [
  { key: "large", label: "大泡泡", sizeClass: "large" },
  { key: "medium", label: "中泡泡", sizeClass: "medium" },
  { key: "small", label: "小泡泡", sizeClass: "small" },
  { key: "micro", label: "微泡泡", sizeClass: "micro" },
];

function normalizeBubbleCounts(value: Partial<BubbleCounts>): BubbleCounts {
  let remaining = MAX_BUBBLES;
  const counts: BubbleCounts = { large: 0, medium: 0, small: 0, micro: 0 };
  for (const key of ["large", "medium", "small", "micro"] as const) {
    counts[key] = Math.min(remaining, Math.max(0, Math.floor(Number(value[key]) || 0)));
    remaining -= counts[key];
  }
  return counts;
}

function readBubbleCounts(): BubbleCounts {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(BUBBLE_COUNTS_KEY) ?? "null");
    return stored && typeof stored === "object" ? normalizeBubbleCounts(stored as Partial<BubbleCounts>) : DEFAULT_BUBBLE_COUNTS;
  } catch {
    return DEFAULT_BUBBLE_COUNTS;
  }
}

function summarizeToTitle(text: string) {
  const birthday = text.match(/(?:给|为)([\p{Script=Han}]{1,8}?)(?:过生日|庆生|过生辰)/u);
  if (birthday) return `${birthday[1]}生日`;
  const filler = /^(?:帮我(?:记一下|记录一下)?|我想(?:记一下|记录一下)?|记录一下|记一下|备忘一下|提醒我|请记住|请帮我记住|我今天|今天我|今天|明天|后天|刚刚|刚才)[，,：:\s]*/;
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/[。！？!?\n；;]/)
    .map((sentence) => sentence.trim().replace(/^[#*•\-\s]+/, "").replace(filler, "").trim())
    .filter(Boolean);
  const actions = [
    ["预约|预订|报名|提交|交|完成|整理|购买|买|联系|拜访|参加|学习|复习|修理|更新|拍摄|拍|带|取|还|寄|发送|发|写|读|听|保存|记录|安排|计划|准备", 8],
    ["看|见|做|开|回|到|去", 6],
  ] as const;
  const candidates: Array<{ title: string; score: number }> = [];
  for (const sentence of sentences) {
    const clauses = sentence.split(/[，,、：:]/).map((part) => part.trim()).filter(Boolean);
    for (const clause of clauses) {
      for (const [verbs, priority] of actions) {
        const matcher = new RegExp(`(?:${verbs})([\\p{Script=Han}A-Za-z0-9]{1,12})`, "gu");
        for (const match of clause.matchAll(matcher)) {
          const candidate = `${match[0]}`
            .replace(/^(?:下周|本周|周[一二三四五六日天]|周末|上午|下午|晚上|今晚|明早|后天|明天|今天)+/, "")
            .replace(/^(?:记录(?:一下|下)?|帮我(?:记住|记录)|提醒我|一下|一趟|一遍|一些|的|要|想|准备|计划|打算)+/, "")
            .replace(/(去|看|见|做|开|回|到|买|拍|发|写|读)了/g, "$1")
            .replace(/些/g, "")
            .trim();
          if (candidate.length < 3) continue;
          candidates.push({ title: candidate, score: priority + Math.min(candidate.length, 8) * 0.3 });
        }
      }
    }
  }
  candidates.sort((a, b) => b.score - a.score || a.title.length - b.title.length);
  const best = candidates[0]?.title ?? sentences.sort((a, b) => b.length - a.length)[0] ?? "";
  const compact = best.replace(/[，,、：:。.!！?？；;]+$/, "").trim();
  return compact.length > 12 ? `${compact.slice(0, 12)}…` : compact;
}

function readNotes(): GlassNote[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(TITLES_KEY) ?? "[]");
    if (!Array.isArray(stored)) return [];
    return stored.slice(0, 3).flatMap((item): GlassNote[] => {
      if (typeof item === "string") return [{ title: summarizeToTitle(item), text: item }];
      if (item && typeof item === "object" && typeof (item as GlassNote).title === "string" && typeof (item as GlassNote).text === "string") {
        return [{ title: (item as GlassNote).title, text: (item as GlassNote).text }];
      }
      return [];
    });
  } catch {
    return [];
  }
}

export function Scene() {
  const [visualStyle, setVisualStyle] = useState<VisualStyle>(() => {
    const saved = localStorage.getItem("one-tap-note.visual-style");
    return saved === "mint" || saved === "dusk" ? saved : "aurora";
  });
  const [composerOpen, setComposerOpen] = useState(false);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");
  const [recording, setRecording] = useState(false);
  const [savedNotes, setSavedNotes] = useState<GlassNote[]>(readNotes);
  const [selectedNote, setSelectedNote] = useState<GlassNote | null>(null);
  const [bubbleCounts, setBubbleCounts] = useState<BubbleCounts>(readBubbleCounts);
  const [bubbleConfigOpen, setBubbleConfigOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  const recognitionErrorRef = useRef(false);
  const baseTextRef = useRef("");

  const openNote = useCallback((initialText?: string) => {
    setComposerOpen(true);
    setStatus("");
    if (initialText !== undefined) setNote(initialText);
  }, []);

  const collapse = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // The recognizer may already have stopped after a browser error.
      }
    }
    setRecording(false);
    setComposerOpen(false);
    setStatus("");
  }, []);

  const saveNote = useCallback(() => {
    const title = summarizeToTitle(note);
    if (!title) return;
    const next = [{ title, text: note.trim() }, ...savedNotes].slice(0, 3);
    setSavedNotes(next);
    try {
      localStorage.setItem(TITLES_KEY, JSON.stringify(next));
    } catch {
      // Keep the current session working if storage is unavailable.
    }
    setNote("");
    collapse();
  }, [collapse, note, savedNotes]);

  const startVoice = useCallback(() => {
    const speechWindow = window as Window & {
      SpeechRecognition?: RecognitionConstructor;
      webkitSpeechRecognition?: RecognitionConstructor;
    };
    const RecognitionAPI = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!RecognitionAPI) {
      setStatus("当前浏览器不支持语音转文字，可使用手机键盘的语音输入，或直接打字。");
      return;
    }

    const recognition = new RecognitionAPI();
    recognitionRef.current = recognition;
    recognition.lang = "zh-CN";
    recognition.continuous = true;
    recognition.interimResults = true;
    baseTextRef.current = note;
    recognitionErrorRef.current = false;

    recognition.onstart = () => {
      setRecording(true);
      setStatus("正在聆听…说完后点击停止录音。");
    };
    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }
      const base = baseTextRef.current;
      setNote(`${base}${base && !base.endsWith("\n") ? "\n" : ""}${transcript}`);
    };
    recognition.onerror = (event) => {
      recognitionErrorRef.current = true;
      const errors: Record<string, string> = {
        "not-allowed": "麦克风未获授权，请在浏览器中允许麦克风权限后重试。",
        "no-speech": "没有听清，再试一次吧。",
        network: "语音服务暂时无法连接，请重试或直接打字。",
        "audio-capture": "没有找到可用的麦克风，请检查设备。",
        aborted: "语音输入已停止。",
      };
      setStatus(errors[event.error] ?? "语音输入暂时不可用，请重试或直接打字。");
    };
    recognition.onend = () => {
      setRecording(false);
      if (!recognitionErrorRef.current) setStatus("语音输入已结束，可以继续编辑。");
    };
    try {
      recognition.start();
    } catch {
      setStatus("无法启动语音输入，请稍后再试。");
    }
  }, [note]);

  useEffect(() => {
    if (composerOpen) textareaRef.current?.focus();
  }, [composerOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (selectedNote) setSelectedNote(null);
      else if (bubbleConfigOpen) setBubbleConfigOpen(false);
      else if (composerOpen) collapse();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [bubbleConfigOpen, collapse, composerOpen, selectedNote]);

  const adjustBubbleCount = (category: keyof BubbleCounts, amount: number) => {
    const nextValue = bubbleCounts[category] + amount;
    const total = Object.values(bubbleCounts).reduce((sum, value) => sum + value, 0);
    if (nextValue < 0 || (amount > 0 && total >= MAX_BUBBLES)) return;
    const next = { ...bubbleCounts, [category]: nextValue };
    setBubbleCounts(next);
    try {
      localStorage.setItem(BUBBLE_COUNTS_KEY, JSON.stringify(next));
    } catch {
      // Keep the current session working if storage is unavailable.
    }
  };

  useEffect(() => () => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // Ignore recognizers that have already stopped during unmount.
    }
  }, []);

  useEffect(() => {
    const modelContext = (document as Document & { modelContext?: { registerTool?: (tool: unknown, options?: { signal?: AbortSignal }) => unknown } }).modelContext;
    if (!modelContext?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(modelContext.registerTool({
        name: "stage_note",
        title: "Stage note draft",
        description: "Open the note composer and fill a draft without saving or sending it.",
        inputSchema: {
          type: "object",
          properties: { text: { type: "string" } },
          required: ["text"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input: unknown) {
          if (!input || typeof input !== "object" || typeof (input as { text?: unknown }).text !== "string" || Object.keys(input).some((key) => key !== "text")) {
            throw new Error("Expected text only");
          }
          const text = (input as { text: string }).text;
          flushSync(() => openNote(text));
          return { status: "draft", text };
        },
      }, { signal: lifecycle.signal })).catch(() => undefined);
    } catch {
      // Browsers without WebMCP support continue to use the visible input.
    }
    return () => lifecycle.abort();
  }, [openNote]);

  return (
    <div className={`app-shell theme-${visualStyle}${composerOpen ? " is-editing" : ""}${recording ? " is-recording" : ""}`}>
      <div className="shader-frame">
        <AnimatedTopDock
          variant="glass"
          bubbleStyle={visualStyle === "mint" ? "star" : visualStyle === "dusk" ? "cookie" : "card"}
          particles={Object.values(bubbleCounts).reduce((sum, value) => sum + value, 0)}
          thickness={0.115}
          dispersion={0.050}
          specular={0.85}
          rim={0.50}
          drift={1.00}
          proximity={44}
          heightGrowth={0}
          drop={0}
          glassTitles={savedNotes.map((savedNote) => savedNote.title)}
          glassNotes={savedNotes}
          onGlassNoteSelect={setSelectedNote}
          bubbleCounts={bubbleCounts}
        />
      </div>

      {!composerOpen && <div className="scene-controls">
        <div className="theme-switcher" role="group" aria-label="切换页面风格">
          {([ ["aurora", "蓝紫玻璃"], ["mint", "薄荷极光"], ["dusk", "暖色暮光"] ] as Array<[VisualStyle, string]>).map(([style, label]) => (
            <button key={style} type="button" className={visualStyle === style ? "is-active" : ""} aria-pressed={visualStyle === style} title={label} aria-label={label} onClick={() => {
              setVisualStyle(style);
              try { localStorage.setItem("one-tap-note.visual-style", style); } catch { /* Keep the selected style for this session. */ }
            }}><span className={`theme-swatch theme-swatch--${style}`} /></button>
          ))}
        </div>
        <button className="bubble-config-trigger" type="button" aria-label="泡泡配置" title="泡泡配置" onClick={() => setBubbleConfigOpen(true)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z"/><path d="m19.3 13.4 1.1.9-1.5 2.6-1.4-.5a7.9 7.9 0 0 1-1.5.9l-.2 1.5h-3l-.3-1.5a7.9 7.9 0 0 1-1.5-.9l-1.4.5-1.5-2.6 1.1-.9a7 7 0 0 1 0-1.8l-1.1-.9 1.5-2.6 1.4.5a7.9 7.9 0 0 1 1.5-.9l.3-1.5h3l.2 1.5a7.9 7.9 0 0 1 1.5.9l1.4-.5 1.5 2.6-1.1.9a7 7 0 0 1 0 1.8Z"/></svg>
        </button>
      </div>}

      {bubbleConfigOpen && <div className="bubble-config-backdrop" onClick={() => setBubbleConfigOpen(false)}>
        <section className="bubble-config" role="dialog" aria-modal="true" aria-labelledby="bubble-config-title" onClick={(event) => event.stopPropagation()}>
          <div className="bubble-config__header">
            <div><span>场景设置</span><h2 id="bubble-config-title">泡泡配置</h2></div>
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

      <main className="note-layer">
        <section className="note-content" aria-label="一键记事">
          <section className="composer" aria-label="输入记录">
              <textarea
                ref={textareaRef}
                aria-label="记录内容"
                placeholder="有什么想记下的？"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
              <div className="composer-actions">
                <button className="voice-button" type="button" onClick={recording ? () => recognitionRef.current?.stop() : startVoice}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M6 11v1a6 6 0 0 0 12 0v-1M12 18v3m-3 0h6" /></svg>
                  <span>{recording ? "停止录音" : "语音输入"}</span>
                </button>
                <div className="composer-buttons">
                  <button className="done-button" type="button" disabled={!note.trim()} onClick={saveNote}>记好了</button>
                </div>
              </div>
              {status && <p className="note-status" role="status">{status}</p>}
          </section>
        </section>
      </main>
      {selectedNote && (
        <div className="note-detail-backdrop" onClick={() => setSelectedNote(null)}>
          <section className="note-detail" role="dialog" aria-modal="true" aria-labelledby="note-detail-title" onClick={(event) => event.stopPropagation()}>
            <div className="note-detail__topline"><span>完整记录</span><button type="button" aria-label="关闭" onClick={() => setSelectedNote(null)}>×</button></div>
            <h2 id="note-detail-title">{selectedNote.title}</h2>
            <p>{selectedNote.text}</p>
          </section>
        </div>
      )}
    </div>
  );
}
