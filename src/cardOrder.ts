import type { NoteRecord } from "./noteHistory";

export const CARD_ORDER_KEY = "one-tap-note.card-order";

export function readCardOrder(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(CARD_ORDER_KEY) ?? "[]");
    return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string"))] : [];
  } catch { return []; }
}

export function orderCards(notes: NoteRecord[], saved: string[]): NoteRecord[] {
  const records = new Map(notes.map((note) => [note.id, note]));
  const known = new Set(saved);
  // Newly created cards enter at the left; existing manual order stays intact.
  const ids = [...notes.filter((note) => !known.has(note.id)).map((note) => note.id), ...saved];
  return [...new Set(ids)].flatMap((id) => records.has(id) ? [records.get(id)!] : []);
}

export function moveCard(ids: string[], id: string, index: number): string[] {
  const next = ids.filter((value) => value !== id);
  next.splice(Math.max(0, Math.min(index, next.length)), 0, id);
  return next;
}

export function mergeVisibleOrder(allIds: string[], visibleIds: string[]): string[] {
  const visible = new Set(visibleIds);
  let index = 0;
  return allIds.map((id) => visible.has(id) ? visibleIds[index++] : id);
}
