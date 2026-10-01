// Real CardsScene pointer interactions in isolated storage; no user notes changed.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const { JSDOM } = require("jsdom");
const dom = new JSDOM('<div id="root"></div>', { url: "https://note-test.invalid/cards" });
for (const name of ["window", "document", "localStorage", "Event", "MouseEvent", "HTMLElement"]) global[name] = dom.window[name];
global.IS_REACT_ACT_ENVIRONMENT = true;
global.requestAnimationFrame = () => 1;
global.cancelAnimationFrame = () => {};
dom.window.HTMLElement.prototype.scrollTo = function(options) { this.scrollTop = options.top ?? this.scrollTop; };
for (const extension of [".ts", ".tsx"]) require.extensions[extension] = (module, filename) => {
  const result = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } });
  module._compile(result.outputText, filename);
};
require.extensions[".css"] = () => {};
const React = require("react");
const { createRoot } = require("react-dom/client");
const { CardsScene } = require("../src/CardsScene.tsx");
const history = require("../src/noteHistory.ts");
const key = "one-tap-note.featured-card";
const record = (id, noteType, createdAt) => ({ id, noteType, createdAt, category: "", title: id, text: `完整内容 ${id}` });
const original = [record("最新急事", "urgent", "2026-10-01T10:00:00Z"), record("生活备忘", "memo", "2026-10-01T09:00:00Z"), record("工作备忘", "memo", "2026-10-01T08:00:00Z")];
localStorage.setItem(history.NOTE_HISTORY_KEY, JSON.stringify(original));
let root = createRoot(document.getElementById("root"));
const render = async (noteType = "all", categoryFilter = null) => React.act(async () => root.render(React.createElement(CardsScene, { embedded: true, noteType, categoryFilter })));
const card = (title) => [...document.querySelectorAll(".memory-card")].find(element => element.querySelector(".memory-card__title").textContent === title);
const featured = () => document.querySelector(".memory-card--featured .memory-card__title")?.textContent;
const pointer = async (element, type, x, y) => React.act(async () => {
  const event = new Event(type, { bubbles: true });
  Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true }, button: { value: 0 }, clientX: { value: x }, clientY: { value: y } });
  element.dispatchEvent(event);
});
const click = async (element, detail = 0) => React.act(async () => element.dispatchEvent(new MouseEvent("click", { bubbles: true, detail })));
const bounds = () => {
  document.querySelector(".card-focus-slot").getBoundingClientRect = () => ({ left: 785, right: 1015, top: 760, bottom: 1065, width: 230, height: 305 });
  for (const element of document.querySelectorAll(".memory-card")) element.getBoundingClientRect = () => ({ left: 800, right: 1000, top: 250, bottom: 515, width: 200, height: 265 });
};
const dragIntoSlot = async (title) => {
  bounds();
  const element = card(title);
  await pointer(element, "pointerdown", 900, 380);
  await pointer(element, "pointermove", 900, 900);
  assert.ok(document.querySelector(".card-focus-slot.is-over"));
  await pointer(element, "pointerup", 900, 900);
  await click(element, 1); // The browser's click after dragging must not open a dialog.
  assert.equal(document.querySelector('[role="dialog"]'), null);
};
(async () => {
  await render();
  await dragIntoSlot("最新急事");
  assert.equal(featured(), "最新急事");
  assert.equal(localStorage.getItem(key), "最新急事");
  assert.equal(document.querySelectorAll(".memory-card:not(.memory-card--featured)").length, 2);
  assert.deepEqual(history.readAllNotes(), original);

  await dragIntoSlot("生活备忘");
  assert.equal(featured(), "生活备忘");
  assert.ok(!card("最新急事").classList.contains("memory-card--featured"));
  // Grab near the top: pointer outside the slot, card center inside it.
  bounds();
  const offsetCard = card("最新急事");
  await pointer(offsetCard, "pointerdown", 900, 270);
  await pointer(offsetCard, "pointermove", 900, 745);
  assert.ok(document.querySelector(".card-focus-slot.is-over"));
  await pointer(offsetCard, "pointerup", 900, 745);
  assert.equal(featured(), "最新急事");
  await dragIntoSlot("生活备忘");
  await render("urgent");
  assert.equal(featured(), "生活备忘");
  assert.equal(document.querySelectorAll('.memory-card--featured').length, 1);
  assert.equal(document.querySelectorAll('.memory-card:not(.memory-card--featured)').length, 1);
  assert.equal(localStorage.getItem(key), "生活备忘");
  await render("memo");
  assert.equal(featured(), "生活备忘");
  assert.equal(document.querySelectorAll('.memory-card:not(.memory-card--featured)').length, 1);
  await render("urgent", "不存在的分类");
  assert.equal(featured(), "生活备忘");
  assert.equal(document.querySelectorAll('.memory-card:not(.memory-card--featured)').length, 0);
  await click(card("生活备忘"));
  assert.ok(document.querySelector('[role="dialog"]'));
  await render("all");
  assert.equal(document.querySelector('[role="dialog"]'), null);
  assert.deepEqual(history.readAllNotes(), original);
  await render("all");
  assert.equal(featured(), "生活备忘");

  await React.act(async () => root.unmount());
  root = createRoot(document.getElementById("root"));
  await render();
  assert.equal(featured(), "生活备忘");
  bounds();
  const pinned = card("生活备忘");
  await pointer(pinned, "pointerdown", 900, 900);
  await pointer(pinned, "pointermove", 900, 380);
  await pointer(pinned, "pointerup", 900, 380);
  assert.equal(featured(), undefined);
  assert.equal(localStorage.getItem(key), null);

  bounds();
  const regular = card("工作备忘");
  await pointer(regular, "pointerdown", 900, 380);
  await pointer(regular, "pointermove", 900, 900);
  await React.act(async () => document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  await pointer(regular, "pointerup", 900, 900);
  assert.equal(featured(), undefined);
  assert.equal(document.querySelector(".memory-card--dragging"), null);

  await click(card("工作备忘"));
  await click(document.querySelector(".memory-detail__feature"));
  assert.equal(featured(), "工作备忘");
  await click(document.querySelector('.card-focus-slot__caption button'));
  assert.equal(featured(), undefined);
  await dragIntoSlot("最新急事");
  await click(card("最新急事"));
  await click(document.querySelector(".memory-detail__delete"));
  assert.equal(featured(), undefined);
  assert.equal(localStorage.getItem(key), null);
  assert.equal(history.readAllNotes().length, 2);
  await React.act(async () => root.unmount());
  dom.window.close();
  console.log("Passed featured card: pointer drop, replacement, drag back, cancellation, accessible actions, persistence, type filtering, deletion and unchanged note metadata/capacity.");
})().catch(error => { console.error(error); process.exitCode = 1; dom.window.close(); });
