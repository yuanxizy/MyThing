import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { AnimatedTopDock } from "@designcodeio/threeui";
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

export function Scene() {
  const [composerOpen, setComposerOpen] = useState(false);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");
  const [recording, setRecording] = useState(false);
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
      if (event.key === "Escape" && composerOpen) collapse();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [collapse, composerOpen]);

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
    <div className={`app-shell${composerOpen ? " is-editing" : ""}${recording ? " is-recording" : ""}`}>
      <div className="shader-frame">
        <AnimatedTopDock
          variant="glass"
          particles={22}
          thickness={0.115}
          dispersion={0.050}
          specular={0.85}
          rim={0.50}
          drift={1.00}
          proximity={44}
          heightGrowth={20}
          drop={11.0}
        />
      </div>

      <main className="note-layer">
        <section className="note-content" aria-label="一键记事">
          <div className="note-heading">
            <h1>{composerOpen ? "想说的，想记的" : "记下这一刻"}</h1>
            <p>{composerOpen ? "写下来，或说给这里听" : "一处入口，打字或语音随时记"}</p>
          </div>

          {!composerOpen ? (
            <button className="note-start" type="button" onClick={() => openNote()}>
              <span className="note-start__icon" aria-hidden="true"><span /></span>
              <span className="note-start__copy"><strong>开始记事</strong><small>打字，或使用语音</small></span>
              <svg className="note-start__arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
            </button>
          ) : (
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
                  <button className="close-button" type="button" onClick={collapse}>收起</button>
                  <button className="done-button" type="button" disabled={!note.trim()} onClick={collapse}>记好了</button>
                </div>
              </div>
              {status && <p className="note-status" role="status">{status}</p>}
            </section>
          )}
        </section>
      </main>
    </div>
  );
}
