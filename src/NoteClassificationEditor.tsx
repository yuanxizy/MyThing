import { useEffect, useState } from "react";
import { updateNoteClassification, type NoteRecord, type NoteType } from "./noteHistory";
import "./note-classification.css";

export function NoteClassificationEditor({ note, onSaved }: {
  note: NoteRecord;
  onSaved: () => void;
}) {
  const [noteType, setNoteType] = useState(note.noteType);
  useEffect(() => setNoteType(note.noteType), [note.noteType]);
  const [error, setError] = useState("");
  const saveType = (nextType: NoteType) => {
    if (nextType === noteType) return;
    const result = updateNoteClassification(note.id, nextType, note.category);
    if (result !== "saved") {
      setError(result === "missing" ? "这条记事已被删除，请关闭窗口后刷新。" : "记事类型保存失败，请重试。");
      return;
    }
    setNoteType(nextType);
    setError("");
    onSaved();
  };
  return <div className="note-classification">
    <div className="note-classification__fields">
      <label>记事类型<select value={noteType} onChange={(event) => saveType(event.target.value as NoteType)}>
        <option value="urgent">急事</option><option value="memo">备忘</option>
      </select></label>
    </div>
    {error && <p role="alert">{error}</p>}
  </div>;
}
