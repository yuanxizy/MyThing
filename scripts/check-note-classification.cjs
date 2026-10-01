const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const path = require("node:path");

// An isolated storage sandbox: these checks never touch the browser's real notes.
const store = new Map();
const localStorage = {
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, value),
};
const exportsObject = {};
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src/noteHistory.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInNewContext(code, { exports: exportsObject, localStorage, crypto: require("node:crypto").webcrypto });
const api = exportsObject;
const plain = (value) => JSON.parse(JSON.stringify(value));

assert.deepEqual(plain(api.parseNoteInput("#工作 明天开会")), { text: "明天开会", category: "工作" });
assert.deepEqual(plain(api.parseNoteInput("买牛奶 #家庭")), { text: "买牛奶", category: "家庭" });
assert.deepEqual(plain(api.parseNoteInput("分类：旅行\n准备护照")), { text: "准备护照", category: "旅行" });
assert.deepEqual(plain(api.parseNoteInput("准备护照\n分类: 旅行")), { text: "准备护照", category: "旅行" });
assert.deepEqual(plain(api.parseNoteInput("分类：家庭，买牛奶")), { text: "买牛奶", category: "家庭" });
assert.deepEqual(plain(api.parseNoteInput("#未分类 买牛奶")), { text: "买牛奶", category: "" });
assert.deepEqual(plain(api.parseNoteInput("C# https://example.com/#工作")), { text: "C# https://example.com/#工作", category: "" });
assert.equal(api.parseNoteInput("#工作").text, "");
for (const [input, text, noteType, category = ""] of [
  ["急事：今天交文件", "今天交文件", "urgent"],
  ["备忘：周末买牛奶", "周末买牛奶", "memo"],
  ["急事 今天交文件", "今天交文件", "urgent"],
  ["备忘周末带伞", "周末带伞", "memo"],
  ["#急事 今天交文件 #工作", "今天交文件", "urgent", "工作"],
  ["记得带伞 #备忘", "记得带伞", "memo"],
  ["分类：急事\n今天买药", "今天买药", "urgent"],
  ["分类：备忘，准备护照", "准备护照", "memo"],
  ["今天交文件\n类型：急事", "今天交文件", "urgent"],
  ["类型：备忘\n分类：旅行\n准备护照", "准备护照", "memo", "旅行"],
]) assert.deepEqual(plain(api.parseNoteInput(input)), { text, category, noteType });
assert.equal(api.parseNoteInput("急事").text, "");
assert.equal(api.parseNoteInput("不是急事，周末再办").noteType, undefined);
assert.equal(api.parseNoteInput("了解急事与备忘的区别").noteType, undefined);

const old = { id: "old", title: "旧记事", text: "原始内容", createdAt: "2026-09-20T12:00:00.000Z" };
localStorage.setItem(api.NOTE_HISTORY_KEY, JSON.stringify([old]));
localStorage.setItem(api.NOTE_TITLES_KEY, JSON.stringify([{ title: "兼容记事", text: "旧格式内容" }]));
let notes = api.readAllNotes();
assert.equal(notes.length, 2);
assert.ok(notes.every((note) => note.category === "" && note.noteType === "memo"));
assert.equal(api.updateNoteClassification("old", "urgent", "#工作"), "saved");
let updated = api.readAllNotes().find((note) => note.id === "old");
assert.deepEqual(plain(updated), { ...old, noteType: "urgent", category: "工作" });
assert.equal(api.readAllNotes().length, 2);
assert.equal(api.filterNotes(api.readAllNotes(), "urgent", "工作").length, 1);
assert.equal(api.filterNotes(api.readAllNotes(), "memo", "工作").length, 0);
assert.equal(api.filterNotes(api.readAllNotes(), "memo", "").length, 1);
assert.equal(api.filterNotes(api.readAllNotes(), "urgent", null).length, 1);
assert.equal(api.filterNotes(api.readAllNotes(), "all", null).length, 2);
assert.equal(api.filterNotes(api.readAllNotes(), "all", "工作").length, 1);
assert.equal(api.updateNoteClassification("old", "memo", ""), "saved");
assert.equal(api.readAllNotes().find((note) => note.id === "old").createdAt, old.createdAt);
assert.equal(api.updateNoteClassification("not-found", "urgent", "工作"), "missing");

const legacy = api.readAllNotes().find((note) => note.id.startsWith("legacy-"));
assert.equal(api.updateNoteClassification(legacy.id, "memo", "家庭"), "saved");
assert.equal(api.readAllNotes().find((note) => note.id === legacy.id).category, "家庭");
api.deleteNoteFromHistory(legacy);
assert.ok(!api.readAllNotes().some((note) => note.id === legacy.id));
assert.equal(api.appendNoteToHistory({ title: "新记事", text: "新的内容", noteType: "urgent", category: " 工作 " }), "saved");
assert.equal(api.readAllNotes()[0].category, "工作");
assert.equal(api.readAllNotes()[0].noteType, "urgent");
for (let index = api.readAllNotes().length; index < api.MAX_NOTES; index++) {
  assert.equal(api.appendNoteToHistory({ title: `记录${index}`, text: `内容${index}`, category: "家庭" }), "saved");
}
assert.equal(api.appendNoteToHistory({ title: "超限", text: "不能保存", category: "旅行" }), "full");
assert.equal(api.updateNoteClassification("old", "urgent", "旅行"), "saved");
assert.equal(api.readAllNotes().length, 10);
assert.deepEqual(plain(api.getNoteCategories(api.readAllNotes())).sort(), ["家庭", "工作", "旅行"].sort());
console.log("Passed: category parsing, legacy migration, metadata edits, type/category filtering, deletion, persistence and the shared 10-note limit.");
