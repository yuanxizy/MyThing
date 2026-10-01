import type { GlassNote } from "./shaders/animated-top-dock/AnimatedTopDock";

export const MAX_NOTES = 10;
export const NOTE_HISTORY_KEY = "one-tap-note.history";
export const NOTE_TITLES_KEY = "one-tap-note.titles";

function notifyNoteHistory() {
  if (typeof window !== "undefined") window.dispatchEvent(new window.Event("one-tap-note:updated"));
}

export function subscribeNoteHistory(refresh: () => void): () => void {
  const events = ["storage", "pageshow", "focus", "one-tap-note:updated"];
  events.forEach((event) => window.addEventListener(event, refresh));
  return () => events.forEach((event) => window.removeEventListener(event, refresh));
}

export type NoteType = "urgent" | "memo";
export type NoteTypeFilter = NoteType | "all";
export function getNoteType(note: { noteType?: unknown }): NoteType {
  return note.noteType === "urgent" ? "urgent" : "memo";
}

export type NoteRecord = GlassNote & {
  noteType: NoteType;
  category: string;
  id: string;
  createdAt: string;
};

export function normalizeCategory(value: unknown): string {
  if (typeof value !== "string") return "";
  const category = value.trim().replace(/^#/, "").replace(/\s+/g, " ").slice(0, 30);
  return category === "未分类" ? "" : category;
}

// Explicit category markers only: ordinary prose, URLs and C# remain note content.
export function parseNoteInput(input: string): { text: string; category: string; noteType?: NoteType } {
  const typeForLabel = (label: string): NoteType | undefined => label === "急事" ? "urgent" : label === "备忘" ? "memo" : undefined;
  const typeDeclaration = /(?:^|\s)(?:记事类型|类型|分类)\s*[:：]\s*(急事|备忘)(?=$|[\s，,。！？!?；;])/u;
  const typeTag = /(^|\s)#(急事|备忘)(?=$|[\s，,。！？!?；;])/gu;
  const declaration = typeDeclaration.exec(input);
  let text = declaration ? input.replace(typeDeclaration, "\n") : input;
  const prefix = /^\s*(急事|备忘)\s*[:：，,；;]?\s*/u.exec(text);
  if (prefix) text = text.slice(prefix[0].length);
  const typeTags = Array.from(text.matchAll(typeTag));
  const noteType = typeForLabel(declaration?.[1] ?? prefix?.[1] ?? typeTags[0]?.[2] ?? "");
  text = text.replace(typeTag, "$1");
  const explicit = /(?:^|\s)分类\s*[:：]\s*([^\n，,；;。]+)/u;
  const tag = /(^|\s)#([\p{L}\p{N}_-]{1,30})(?=$|\s|[，,。！？!？；;])/gu;
  const match = explicit.exec(text);
  const tags = Array.from(text.matchAll(tag));
  const category = normalizeCategory(match?.[1] ?? tags[0]?.[2] ?? "");
  if (match) text = text.replace(explicit, "\n");
  if (match || tags.length) text = text.replace(tag, (whole, prefix: string, name: string) => normalizeCategory(name) === category ? prefix : whole);
  return { text: text.trim().replace(/^[，,；;]\s*/, ""), category, ...(noteType ? { noteType } : {}) };
}

export function filterNotes(notes: NoteRecord[], noteType: NoteTypeFilter, category: string | null): NoteRecord[] {
  return notes.filter((note) => (noteType === "all" || note.noteType === noteType) && (category === null || note.category === category));
}

export function getNoteCategories(notes: NoteRecord[]): string[] {
  return [...new Set(notes.map((note) => note.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
}

export function readNoteHistory(): NoteRecord[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(NOTE_HISTORY_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is NoteRecord => Boolean(
      item && typeof item === "object" &&
      typeof item.id === "string" && typeof item.title === "string" &&
      typeof item.text === "string" && typeof item.createdAt === "string",
    )).map((item) => ({ ...item, noteType: getNoteType(item), category: normalizeCategory(item.category) }));
  } catch {
    return [];
  }
}

export function readAllNotes(): NoteRecord[] {
  const history = readNoteHistory();
  const knownTexts = new Set(history.map((item) => item.text));
  let legacy: unknown = [];
  try {
    legacy = JSON.parse(localStorage.getItem(NOTE_TITLES_KEY) ?? "[]");
  } catch {
    // Continue saving the new note if an older local entry is malformed.
  }
  if (Array.isArray(legacy)) {
    legacy.forEach((item, index) => {
      if (!item || typeof item.title !== "string" || typeof item.text !== "string" || knownTexts.has(item.text)) return;
      history.push({
        id: `legacy-${index}-${item.text.slice(0, 12)}`,
        title: item.title,
        text: item.text,
        noteType: getNoteType(item),
        category: normalizeCategory(item.category),
        createdAt: new Date().toISOString(),
      });
      knownTexts.add(item.text);
    });
  }
  return history.sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
}

export function appendNoteToHistory(note: GlassNote & { noteType?: NoteType; category?: string }): "saved" | "full" | "error" {
  try {
    const history = readAllNotes();
    if (history.length >= MAX_NOTES) return "full";
    const record: NoteRecord = {
      ...note,
      noteType: getNoteType(note),
      category: normalizeCategory(note.category),
      id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${history.length}`,
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem(NOTE_HISTORY_KEY, JSON.stringify([record, ...history]));
    notifyNoteHistory();
    return "saved";
  } catch {
    return "error";
  }
}

export function updateNoteClassification(id: string, noteType: NoteType, category: string): "saved" | "missing" | "error" {
  try {
    const history = readAllNotes();
    if (!history.some((note) => note.id === id)) return "missing";
    const next = history.map((note) => note.id === id ? { ...note, noteType: getNoteType({ noteType }), category: normalizeCategory(category) } : note);
    localStorage.setItem(NOTE_HISTORY_KEY, JSON.stringify(next));
    // The history is authoritative; legacy entries are read only for migration.
    try { localStorage.setItem(NOTE_TITLES_KEY, JSON.stringify(next.slice(0, 3))); } catch { /* History is already saved. */ }
    notifyNoteHistory();
    return "saved";
  } catch {
    return "error";
  }
}

export function deleteNoteFromHistory(note: NoteRecord): void {
  try {
    localStorage.setItem(NOTE_HISTORY_KEY, JSON.stringify(readNoteHistory().filter((item) => item.id !== note.id)));
  } catch {
    // The caller still removes the card from the current view.
  }
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(NOTE_TITLES_KEY) ?? "[]");
    if (Array.isArray(saved)) {
      localStorage.setItem(NOTE_TITLES_KEY, JSON.stringify(saved.filter((item) => !item || typeof item !== "object" || (item as { text?: unknown }).text !== note.text)));
    }
  } catch {
    // Keep the rest of the saved history usable if the legacy title list is malformed.
  }
  notifyNoteHistory();
}
