import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { deleteNoteFromHistory, filterNotes, readAllNotes, subscribeNoteHistory, type NoteRecord, type NoteTypeFilter } from "./noteHistory";
import { NoteClassificationEditor } from "./NoteClassificationEditor";
import { CARD_ORDER_KEY, mergeVisibleOrder, moveCard, orderCards, readCardOrder } from "./cardOrder";
import "./cards.css";

const CARD_LAYOUT_KEY = "one-tap-note.card-layout";
const FEATURED_CARD_KEY = "one-tap-note.featured-card";
const ROW_STRIDE = 414;
type CardPosition = { x: number; y: number; angle: number };
type CardLayout = Record<string, CardPosition>;
type PlanetRopeGeometry = { width: number; viewHeight: number; top: number; height: number; path: string };
type CardDrag = { id: string; x: number; y: number; overSlot: boolean; ropeIndex: number | null };
type DragSession = { id: string; pointerId: number; startX: number; startY: number; centerX: number; centerY: number; height: number; active: boolean };

function ropePosition(x: number, count: number, embedded: boolean): CardPosition {
  return { x, y: 12 + 420 * (x / 100) * (1 - x / 100), angle: (50 - x) * (embedded && count === 2 ? 0.12 : 0.36) };
}

function readFeaturedCard(): string | null {
  try { return localStorage.getItem(FEATURED_CARD_KEY); } catch { return null; }
}

function getPlanetParallelRope(width: number, viewportHeight: number, galleryTop: number): PlanetRopeGeometry {
  const hostScale = 2.95;
  const hostSize = 1400;
  const cameraDistance = 3.5;
  const globeRadius = 1.035;
  const focalLength = hostSize / (2 * Math.tan(42 * Math.PI / 360));
  const planetRadius = focalLength * globeRadius / Math.sqrt(cameraDistance ** 2 - globeRadius ** 2) * hostScale;
  const planetCenterY = Math.max(118, Math.min(viewportHeight * 0.2, 190)) - 3639 + hostSize * hostScale / 2;
  const ropeRadius = Math.max(planetRadius + 38, width / 2 + 1);
  const halfWidth = width / 2;
  const edgeY = planetCenterY + Math.sqrt(ropeRadius ** 2 - halfWidth ** 2);
  const sag = ropeRadius - Math.sqrt(ropeRadius ** 2 - halfWidth ** 2);
  const height = Math.max(8, sag + 8);
  const top = edgeY - galleryTop - 4;
  return {
    width,
    viewHeight: height,
    top,
    height,
    path: `M 0 4 A ${ropeRadius} ${ropeRadius} 0 0 0 ${width} 4`,
  };
}

function readCardLayout(): CardLayout {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(CARD_LAYOUT_KEY) ?? "{}");
    return value && typeof value === "object" ? value as CardLayout : {};
  } catch {
    return {};
  }
}

function writeCardLayout(layout: CardLayout) {
  try { localStorage.setItem(CARD_LAYOUT_KEY, JSON.stringify(layout)); } catch { /* Keep card rendering available without storage. */ }
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "刚刚记录";
  return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "short" }).format(date);
}

export function CardsScene({ embedded = false, noteType = "all", categoryFilter = null }: { embedded?: boolean; noteType?: NoteTypeFilter; categoryFilter?: string | null }) {
  const [allNotes, setNotes] = useState(readAllNotes);
  const [cardOrder, setCardOrder] = useState(readCardOrder);
  const orderedNotes = useMemo(() => orderCards(allNotes, cardOrder), [allNotes, cardOrder]);
  const notes = useMemo(() => filterNotes(orderedNotes, noteType, categoryFilter), [orderedNotes, noteType, categoryFilter]);
  const [featuredId, setFeaturedId] = useState<string | null>(readFeaturedCard);
  const featuredNote = allNotes.find((note) => note.id === featuredId);
  const renderedNotes = featuredNote && !notes.some((note) => note.id === featuredId) ? [...notes, featuredNote] : notes;
  const ropeNotes = useMemo(() => notes.filter((note) => note.id !== featuredId), [notes, featuredId]);
  const slotRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLElement>(null);
  const dragSession = useRef<DragSession | null>(null);
  const suppressClick = useRef(false);
  const [drag, setDrag] = useState<CardDrag | null>(null);
  const previewRopeNotes = useMemo(() => {
    if (drag?.ropeIndex == null) return ropeNotes;
    const ids = moveCard(ropeNotes.map((note) => note.id), drag.id, drag.ropeIndex);
    return ids.flatMap((id) => allNotes.find((note) => note.id === id) ?? []);
  }, [drag?.id, drag?.ropeIndex, ropeNotes, allNotes]);
  const [focusStatus, setFocusStatus] = useState("");
  const noteTypeLabel = noteType === "all" ? "记事" : noteType === "urgent" ? "急事" : "备忘";
  const [selectedNote, setSelectedNote] = useState<NoteRecord | null>(null);
  useEffect(() => setSelectedNote(null), [noteType, categoryFilter]);
  const galleryRef = useRef<HTMLDivElement>(null);
  const [planetRope, setPlanetRope] = useState<PlanetRopeGeometry | null>(null);
  const targetLayout = useMemo<CardLayout>(() => {
    const layout: CardLayout = {};
    const count = previewRopeNotes.length;
    const span = count === 1 ? 0 : count === 2 ? 52 : count === 3 ? 68 : 76;
    previewRopeNotes.forEach((note, index) => {
      const x = count === 1 ? 50 : 50 - span / 2 + index / (count - 1) * span;
      layout[note.id] = ropePosition(x, count, embedded);
    });
    return layout;
  }, [embedded, previewRopeNotes]);
  const layoutSignature = previewRopeNotes.map((note) => note.id).join("|");
  const previousLayoutRef = useRef<CardLayout>(readCardLayout());
  const [startLayout, setStartLayout] = useState<CardLayout>(() => previousLayoutRef.current);
  const [animateToTarget, setAnimateToTarget] = useState(() => Object.keys(previousLayoutRef.current).length === 0);
  const lastSignatureRef = useRef("");

  const showFeaturedSlot = () => {
    if (embedded && window.innerHeight <= 980) {
      pageRef.current?.scrollTo({ top: 760 - window.innerHeight / 2, behavior: "smooth" });
    }
  };

  const selectFeaturedCard = (id: string | null) => {
    setFeaturedId(id);
    setFocusStatus(id ? "已设为 C 位卡" : "卡片已移回挂线");
    if (id) showFeaturedSlot();
    else pageRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    try {
      if (id) localStorage.setItem(FEATURED_CARD_KEY, id);
      else localStorage.removeItem(FEATURED_CARD_KEY);
    } catch { setFocusStatus("本次已生效，但浏览器未能保存 C 位选择。"); }
  };

  useEffect(() => {
    if (featuredId && !allNotes.some((note) => note.id === featuredId)) {
      setFeaturedId(null);
      try { localStorage.removeItem(FEATURED_CARD_KEY); } catch { /* Current view is cleared. */ }
    }
  }, [allNotes, featuredId]);

  const isInsideSlot = (x: number, y: number) => {
    const bounds = slotRef.current?.getBoundingClientRect();
    return Boolean(bounds && x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom);
  };

  const isDropInSlot = (session: DragSession, x: number, y: number) => {
    // Keep the grab offset: dropping the card itself into the slot also counts.
    const centerX = session.centerX + x - session.startX;
    const centerY = session.centerY + y - session.startY;
    return isInsideSlot(x, y) || isInsideSlot(centerX, centerY);
  };

  const dragPlacement = (session: DragSession, x: number, y: number) => {
    const centerX = session.centerX + x - session.startX;
    const centerY = session.centerY + y - session.startY;
    const horizontalSort = session.id !== featuredId && Math.abs(y - session.startY) <= 90;
    const overSlot = !horizontalSort && isDropInSlot(session, x, y);
    const gallery = galleryRef.current?.getBoundingClientRect();
    let ropeIndex: number | null = null;
    if (!overSlot && gallery && gallery.width > 0 && notes.some((note) => note.id === session.id)) {
      const count = ropeNotes.length + (session.id === featuredId ? 1 : 0);
      const span = count <= 1 ? 0 : count === 2 ? 52 : count === 3 ? 68 : 76;
      const fraction = (centerX - gallery.left) / gallery.width;
      const index = count <= 1 ? 0 : Math.round((fraction * 100 - 50 + span / 2) / span * (count - 1));
      const clamped = Math.max(0, Math.min(index, count - 1));
      const cardX = count <= 1 ? 50 : 50 - span / 2 + clamped / (count - 1) * span;
      const normalHeight = session.height / (session.id === featuredId ? 1.15 : 1);
      const rowCenterY = gallery.top + ropePosition(cardX, count, embedded).y + normalHeight / 2;
      if (Math.abs(centerY - rowCenterY) <= Math.max(65, normalHeight * .45)) ropeIndex = clamped;
    }
    return { x: centerX, y: centerY, overSlot, ropeIndex };
  };

  const saveRopeOrder = (id: string, index: number) => {
    const visible = moveCard(ropeNotes.map((note) => note.id), id, index);
    const next = mergeVisibleOrder(orderedNotes.map((note) => note.id), visible);
    setCardOrder(next);
    // Other cards are already at their preview positions; preserve that on release.
    previousLayoutRef.current = targetLayout;
    setFocusStatus("卡片顺序已调整");
    try { localStorage.setItem(CARD_ORDER_KEY, JSON.stringify(next)); }
    catch { setFocusStatus("顺序已调整，但浏览器未能保存。"); }
    if (id === featuredId) selectFeaturedCard(null);
  };

  const beginDrag = (event: ReactPointerEvent<HTMLButtonElement>, id: string) => {
    if (event.button !== 0 || event.isPrimary === false) return;
    suppressClick.current = false;
    const bounds = event.currentTarget.getBoundingClientRect();
    dragSession.current = { id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, centerX: bounds.left + bounds.width / 2, centerY: bounds.top + bounds.height / 2, height: bounds.height, active: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const session = dragSession.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const dx = event.clientX - session.startX;
    const dy = event.clientY - session.startY;
    if (!session.active && Math.hypot(dx, dy) < 6) return;
    session.active = true;
    suppressClick.current = true;
    setDrag({ id: session.id, ...dragPlacement(session, event.clientX, event.clientY) });
  };

  const cancelDrag = () => {
    dragSession.current = null;
    setDrag(null);
  };

  const endDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const session = dragSession.current;
    if (!session || session.pointerId !== event.pointerId) return;
    if (session.active) {
      const placement = dragPlacement(session, event.clientX, event.clientY);
      if (placement.overSlot) selectFeaturedCard(session.id);
      else if (placement.ropeIndex !== null) saveRopeOrder(session.id, placement.ropeIndex);
      else if (session.id === featuredId) selectFeaturedCard(null);
    }
    cancelDrag();
  };

  useEffect(() => { cancelDrag(); }, [noteType, categoryFilter]);

  useLayoutEffect(() => {
    const gallery = galleryRef.current;
    if (!embedded || !gallery) return undefined;
    const update = () => {
      const bounds = gallery.getBoundingClientRect();
      setPlanetRope(getPlanetParallelRope(window.innerWidth, window.innerHeight, bounds.top));
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [embedded, renderedNotes.length]);

  const deleteSelectedNote = () => {
    if (!selectedNote) return;
    deleteNoteFromHistory(selectedNote);
    setSelectedNote(null);
  };

  useLayoutEffect(() => {
    if (drag) return;
    if (lastSignatureRef.current === layoutSignature) return;
    lastSignatureRef.current = layoutSignature;

    const previous = previousLayoutRef.current;
    if (Object.keys(previous).length === 0) {
      setStartLayout(targetLayout);
      setAnimateToTarget(true);
      previousLayoutRef.current = targetLayout;
      writeCardLayout(targetLayout);
      return;
    }

    const initial: CardLayout = {};
    Object.entries(targetLayout).forEach(([id, target]) => {
      initial[id] = previous[id] ?? { x: 0, y: Math.floor(target.y / ROW_STRIDE) * ROW_STRIDE + 12, angle: 18 };
    });
    setStartLayout(initial);
    setAnimateToTarget(false);
    const firstFrame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setAnimateToTarget(true);
        previousLayoutRef.current = targetLayout;
        writeCardLayout(targetLayout);
      });
    });
    return () => cancelAnimationFrame(firstFrame);
  }, [layoutSignature, targetLayout, Boolean(drag)]);

  useEffect(() => {
    const refresh = () => {
      const next = readAllNotes();
      if (dragSession.current && !next.some((note) => note.id === dragSession.current!.id)) cancelDrag();
      setNotes(next);
      setSelectedNote((current) => current ? next.find((note) => note.id === current.id) ?? null : null);
      setFeaturedId(readFeaturedCard());
      setCardOrder(readCardOrder());
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") { setSelectedNote(null); cancelDrag(); } };
    const unsubscribe = subscribeNoteHistory(refresh);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      unsubscribe();
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return <main ref={pageRef} className={`cards-page${embedded ? " cards-page--embedded" : ""}`}>
    <section className="cards-list" aria-label="记事卡片">
      {renderedNotes.length > 0 ? <div className="memory-gallery" ref={galleryRef} style={{ height: `${ROW_STRIDE}px` }}>
        {embedded ? <svg
          className="memory-rope memory-rope--planet"
          style={{ top: planetRope?.top ?? 0, height: planetRope?.height ?? 120 }}
          viewBox={`0 0 ${planetRope?.width ?? window.innerWidth} ${planetRope?.viewHeight ?? 120}`}
          preserveAspectRatio="none" aria-hidden="true"
        ><path d={planetRope?.path ?? "M0 0 Q500 210 1000 0"} /></svg> : <svg className="memory-rope" viewBox="0 0 1000 120" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0 Q500 210 1000 0" /></svg>}
        {renderedNotes.map((note) => {
          const cardIndex = allNotes.findIndex((record) => record.id === note.id);
          const isFeatured = note.id === featuredId;
          const isDragging = drag?.id === note.id;
          const target = targetLayout[note.id] ?? { x: 50, y: 117, angle: 0 };
          const position = drag || animateToTarget ? target : startLayout[note.id] ?? target;
          const galleryBounds = isDragging && drag.ropeIndex !== null ? galleryRef.current?.getBoundingClientRect() : null;
          const sliding = galleryBounds ? ropePosition(Math.max(0, Math.min(100, (drag!.x - galleryBounds.left) / galleryBounds.width * 100)), previewRopeNotes.length, embedded) : null;
          const dragStyle: CSSProperties = isDragging ? sliding
            ? { position: "absolute", left: `${sliding.x}%`, top: sliding.y, transformOrigin: "50% 0", transform: `translateX(-50%) rotate(${sliding.angle}deg) scale(${embedded ? 1.25 : 1})` }
            : { position: "fixed", left: drag.x, top: drag.y, transform: `translate(-50%, -50%) scale(${(embedded ? 1.25 : 1) * (isFeatured ? 1.15 : 1)})` }
            : {};
          const style = { "--card-x": `${position.x}%`, "--card-y": `${position.y}px`, "--card-rotation": `${position.angle}deg`, ...dragStyle } as CSSProperties;
          return <button className={`memory-card memory-card--${cardIndex % 4}${isFeatured ? " memory-card--featured" : ""}${isDragging ? " memory-card--dragging" : ""}`} key={note.id} style={style} type="button"
            draggable={false} onDragStart={(event) => event.preventDefault()}
            aria-describedby="card-focus-help"
            onPointerDown={(event) => beginDrag(event, note.id)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag}
            onClick={(event) => { if (suppressClick.current && event.detail !== 0) { suppressClick.current = false; return; } setSelectedNote(note); }}>
            <svg className={`memory-card__clip${note.noteType === "urgent" ? " memory-card__clip--urgent" : ""}`} viewBox="0 0 24 34" fill="none" aria-hidden="true" focusable="false">
              <path d="M8 19 6.5 6.5C6.2 3.6 7.8 2 12 2s5.8 1.6 5.5 4.5L16 19" stroke="#dce9eb" strokeWidth="2" strokeLinecap="round" />
              <path d="M8.7 17 7.5 6.7C7.3 4.5 8.5 3.8 12 3.8s4.7.7 4.5 2.9L15.3 17" stroke="#718d92" strokeWidth=".8" />
              <path d="M5 16h14l2.5 13.5a2 2 0 0 1-2 2.5h-15a2 2 0 0 1-2-2.5L5 16Z" fill="var(--clip-body, #7fc5ae)" stroke="var(--clip-edge, #528f81)" strokeWidth="1.2" strokeLinejoin="round" />
              <path d="M6 18h12l1.5 10H4.5L6 18Z" fill="var(--clip-face, #a6dfc6)" />
              <path d="M6.5 19.5h11" stroke="var(--clip-highlight, #e6fff0)" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M4 29h16" stroke="var(--clip-edge, #528f81)" strokeWidth="1.4" strokeLinecap="round" />
              <path d="M9 16v3m6-3v3" stroke="#517b78" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="memory-card__top"><span className="memory-card__icon" aria-hidden="true">{["✳", "◒", "✿", "✦"][cardIndex % 4]}</span><span className="memory-card__date">{formatDate(note.createdAt)}</span></span>
            <span className="memory-card__title">{note.title}</span>
            <span className="memory-card__excerpt">{note.text}</span>
          </button>;
        })}
        {drag?.ropeIndex != null && <span className="memory-rope-drop-marker" style={{ left: `${targetLayout[drag.id].x}%`, top: targetLayout[drag.id].y - 32 }} aria-hidden="true">放在这里</span>}
      </div> : <div className="cards-empty">
        <span className="cards-empty__symbol" aria-hidden="true">✳</span>
        <h3>{categoryFilter !== null ? `“${categoryFilter || "未分类"}”中暂无${noteTypeLabel}` : `还没有${noteTypeLabel}`}</h3>
        <p>{embedded ? "从屏幕底部输入一条记事，新卡片会自动挂到线上。" : "回到泡泡主页记下一刻，新卡片会自动加入目录。"}</p>
        {!embedded && <a href="/">去记一条 <span aria-hidden="true">↗</span></a>}
      </div>}
    </section>

    <div ref={slotRef} className={`card-focus-slot${featuredNote ? " is-filled" : ""}${drag ? " is-dragging" : ""}${drag?.overSlot ? " is-over" : ""}`} role="region" aria-label="C位卡槽">
      {(!featuredNote || drag) && <div className="card-focus-slot__hint"><span aria-hidden="true">✦</span><strong>{drag?.overSlot ? "松开设为 C 位" : "C 位卡"}</strong><small>{drag ? "拖到这里，松开即可" : "拖一张卡片到这里"}</small></div>}
      {featuredNote && !drag && <div className="card-focus-slot__caption"><span>C 位卡</span><button type="button" aria-label="将C位卡移回挂线" onClick={() => selectFeaturedCard(null)}>移回挂线 ↗</button></div>}
    </div>
    {embedded && <button type="button" className="card-focus-jump" aria-label="查看C位卡槽" onClick={showFeaturedSlot}><span>C 位</span><span aria-hidden="true">↓</span></button>}
    <span id="card-focus-help" className="card-focus-sr-only">沿挂线左右拖动可排序；拖到页面中下方可设为C位卡，也可以点开卡片后选择设为C位。</span>
    <span className="card-focus-sr-only" role="status">{focusStatus}</span>

    {selectedNote && <div className="memory-detail-backdrop" onClick={() => setSelectedNote(null)}>
      <article className="memory-detail" role="dialog" aria-modal="true" aria-labelledby="memory-detail-title" onClick={(event) => event.stopPropagation()}>
        <div className="memory-detail__top"><span>{formatDate(selectedNote.createdAt)}</span><button type="button" aria-label="关闭" onClick={() => setSelectedNote(null)}>×</button></div>
        <h2 id="memory-detail-title">{selectedNote.title}</h2>
        <p>{selectedNote.text}</p>
        <NoteClassificationEditor key={selectedNote.id} note={selectedNote} onSaved={() => setSelectedNote(null)} />
        <div className="memory-detail__actions">
          <button className="memory-detail__feature" type="button" onClick={() => { selectFeaturedCard(selectedNote.id === featuredId ? null : selectedNote.id); setSelectedNote(null); }}>{selectedNote.id === featuredId ? "移回挂线" : "设为 C 位"}</button>
          <button className="memory-detail__delete" type="button" onClick={deleteSelectedNote}>删除卡片</button>
        </div>
      </article>
    </div>}
  </main>;
}
