// Exercise the real composer, storage, filtering and classification editor in
// an isolated DOM. Only the unrelated WebGL surfaces are replaced with fixtures.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { JSDOM } = require("jsdom");
const dom = new JSDOM('<div id="root"></div>', { url: "https://note-test.invalid/cards" });
for (const name of ["window", "document", "localStorage", "Event", "MouseEvent", "HTMLElement"]) global[name] = dom.window[name];
global.IS_REACT_ACT_ENVIRONMENT = true;
let frameId = 0;
global.requestAnimationFrame = () => ++frameId;
global.cancelAnimationFrame = () => {};
const React = require("react");
const { createRoot } = require("react-dom/client");

for (const extension of [".ts", ".tsx"]) require.extensions[extension] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  module._compile(outputText, filename);
};
require.extensions[".css"] = () => {};
const fixture = (relativePath, exports) => {
  const filename = path.resolve(__dirname, "../src", relativePath);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
};
fixture("shaders/animated-top-dock/AnimatedTopDock.tsx", {
  AnimatedTopDock: ({ glassNotes, onGlassNoteSelect, bubbleCounts }) => React.createElement("div", { "data-testid": "bubble-notes", "data-counts":JSON.stringify(bubbleCounts) },
    glassNotes.map((note) => React.createElement("button", { key: note.id, type: "button", onClick: () => onGlassNoteSelect(note) }, note.title))),
});
for (const name of ["EarthGlobe", "SaturnGlobe", "MoonGlobe"]) fixture(`${name}.tsx`, { [name]: () => null });
const { OriginalScene } = require("../src/OriginalScene.tsx");
const history = require("../src/noteHistory.ts");

const click = async (element) => {
  assert.ok(element, "Missing action button");
  await React.act(async () => element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })));
};
const change = async (element, value) => {
  assert.ok(element, "Missing input");
  const prototype = element.tagName === "TEXTAREA" ? dom.window.HTMLTextAreaElement.prototype : element.tagName === "SELECT" ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype;
  await React.act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value").set.call(element, value);
    element.dispatchEvent(new Event(element.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  });
};
const typeButton = (label) => [...document.querySelectorAll(".note-type-switch button")].find((button) => button.textContent === label);
const input = () => document.querySelector('textarea[aria-label="记录内容"]');
const save = () => document.querySelector(".done-button");
const hint = () => document.querySelector(".original-page__input-hint").textContent;
const visibleTitles = (cards) => [...document.querySelectorAll(cards ? ".memory-card__title" : '[data-testid="bubble-notes"] button')].map((item) => item.textContent);

(async () => {
  for (const cards of [true, false]) {
    localStorage.clear();
    if (!cards) localStorage.setItem('one-tap-note.bubble-counts',JSON.stringify({large:0,medium:0,small:20,micro:14}));
    window.history.replaceState({}, "", cards ? "/cards" : "/");
    const root = createRoot(document.getElementById("root"));
    await React.act(async () => root.render(React.createElement(OriginalScene)));
    assert.equal(typeButton("全部").getAttribute("aria-pressed"), "true");
    assert.equal(document.querySelector(".note-category-filter"), null);
    await click(typeButton("备忘"));

    // Typed urgency overrides the opposite toolbar choice, both in preview and storage.
    await change(input(), "急事：今天交文件");
    assert.equal(hint(), "识别为急事");
    await click(save());
    let notes = history.readAllNotes();
    assert.equal(notes[0].noteType, "urgent");
    assert.equal(notes[0].text, "今天交文件");
    assert.equal(notes[0].category, "");
    assert.equal(typeButton("急事").getAttribute("aria-pressed"), "true");
    assert.ok(visibleTitles(cards).includes("今天交文件"));
    await click(typeButton("备忘"));
    assert.ok(!visibleTitles(cards).includes("今天交文件"));
    await click(typeButton("急事"));
    assert.ok(visibleTitles(cards).includes("今天交文件"));

    await change(input(), "备忘：周末买牛奶 #家庭");
    assert.equal(hint(), "识别为备忘 · 家庭");
    await click(save());
    notes = history.readAllNotes();
    assert.equal(notes[0].noteType, "memo");
    assert.equal(notes[0].category, "家庭");
    assert.equal(notes[0].text, "周末买牛奶");
    assert.equal(localStorage.getItem("one-tap-note.note-type"), "memo");
    assert.ok(visibleTitles(cards).includes("周末买牛奶"));

    assert.ok(!visibleTitles(cards).includes("今天交文件"));

    await change(input(), "#急事 今天送合同 #工作");
    assert.equal(hint(), "识别为急事 · 工作");
    await click(save());
    const contract = history.readAllNotes()[0];
    assert.equal(contract.noteType, "urgent");
    assert.equal(contract.category, "工作");
    assert.equal(contract.text, "今天送合同");

    await click(typeButton("全部"));
    assert.deepEqual(visibleTitles(cards), history.readAllNotes().map((note) => note.title));
    if (!cards) {
      const counts = JSON.parse(document.querySelector('[data-testid="bubble-notes"]').dataset.counts);
      assert.equal(counts.large + counts.medium, history.readAllNotes().length, 'Auto-grow large/medium carriers even when decorations fill the base limit');
      assert.equal(counts.small,20);
      assert.equal(counts.micro,14);
    }
    await click(typeButton("急事"));

    // Type changes save immediately while preserving the existing category.
    const title = [...document.querySelectorAll(cards ? ".memory-card__title" : '[data-testid="bubble-notes"] button')].find((item) => item.textContent === "今天送合同");
    await click(cards ? title.closest("button") : title);
    assert.equal(document.querySelector(".note-classification input"), null);
    assert.equal(document.querySelector(".note-classification__actions"), null);
    assert.ok(!document.querySelector(".note-classification").textContent.includes("所属分类"));
    await change(document.querySelector(".note-classification select"), "memo");
    const edited = history.readAllNotes().find((note) => note.id === contract.id);
    assert.equal(edited.noteType, "memo");
    assert.equal(edited.category, "工作");
    assert.equal(edited.text, contract.text);
    assert.equal(edited.createdAt, contract.createdAt);
    assert.ok(!visibleTitles(cards).includes("今天送合同"));
    await click(typeButton("备忘"));
    assert.ok(visibleTitles(cards).includes("今天送合同"));
    assert.ok(visibleTitles(cards).includes("周末买牛奶"));

    // Another view edits/deletes the same record while its detail is open.
    const detailTitle = [...document.querySelectorAll(cards ? ".memory-card__title" : '[data-testid="bubble-notes"] button')].find((item) => item.textContent === "今天送合同");
    await click(cards ? detailTitle.closest("button") : detailTitle);
    await React.act(async () => history.updateNoteClassification(contract.id, "urgent", "工作"));
    assert.equal(document.querySelector('.note-classification select').value, "urgent");
    await React.act(async () => history.deleteNoteFromHistory(contract));
    assert.equal(document.querySelector('[role="dialog"]'), null);
    assert.ok(!visibleTitles(cards).includes("今天送合同"));

    await change(input(), "分类：急事，今天买药");
    assert.equal(hint(), "识别为急事");
    await click(save());
    assert.equal(history.readAllNotes()[0].noteType, "urgent");
    assert.equal(history.readAllNotes()[0].text, "今天买药");
    await click(typeButton("备忘"));
    await change(input(), "普通记录，没有指定类型");
    assert.equal(hint(), "记入备忘");
    await click(save());
    assert.equal(history.readAllNotes()[0].noteType, "memo");

    await click(typeButton("全部"));
    await change(input(), "全部视图中的普通记录");
    assert.equal(hint(), "记入备忘");
    await click(save());
    assert.equal(history.readAllNotes()[0].noteType, "memo");
    assert.equal(typeButton("全部").getAttribute("aria-pressed"), "true");
    await change(input(), "急事：全部视图中的急事");
    await click(save());
    assert.equal(history.readAllNotes()[0].noteType, "urgent");
    assert.equal(typeButton("全部").getAttribute("aria-pressed"), "true");
    assert.deepEqual(visibleTitles(cards), history.readAllNotes().map((note) => note.title));
    await React.act(async () => root.unmount());
    const restoredRoot = createRoot(document.getElementById("root"));
    await React.act(async () => restoredRoot.render(React.createElement(OriginalScene)));
    assert.equal(typeButton("全部").getAttribute("aria-pressed"), "true");
    assert.deepEqual(visibleTitles(cards), history.readAllNotes().map((note) => note.title));
    await click(typeButton("备忘"));

    await change(input(), "急事");
    assert.equal(hint(), "识别为急事");
    assert.ok(save().disabled, "A type marker alone must not create an empty record");
    await React.act(async () => {
      for (let index = history.readAllNotes().length; index < history.MAX_NOTES; index++) history.appendNoteToHistory({ title: `容量测试${index}`, text: `内容${index}` });
    });
    await change(input(), "急事：容量已满仍尝试保存");
    await click(save());
    assert.equal(history.readAllNotes().length, 10);
    assert.ok(document.querySelector(".note-status").textContent.includes("上限"));
    assert.equal(input().value, "急事：容量已满仍尝试保存");
    assert.equal(typeButton("备忘").getAttribute("aria-pressed"), "true");
    if (!cards) {
      await click(typeButton('全部'));
      const counts = JSON.parse(document.querySelector('[data-testid="bubble-notes"]').dataset.counts);
      assert.equal(counts.large+counts.medium,10);
      assert.equal(counts.small+counts.micro,34);
    }
    await React.act(async () => restoredRoot.unmount());
    console.log(`Passed ${cards ? "cards" : "bubbles"}: actual input/change/click events, preview, opposite-type override, save, filter, editor, empty input and shared capacity.`);
  }
  dom.window.close();
})().catch((error) => { console.error(error); process.exitCode = 1; dom.window.close(); });
