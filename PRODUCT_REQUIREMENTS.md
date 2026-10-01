# Product requirements

## Shared notes across views

- Bubble and card pages are two presentations of the same local note history, IDs, text, type, category and shared 10-note capacity. Adding, deleting and changing classification in either view updates both immediately, including other tabs on the same origin.
- Restore the current shared history when a page regains focus or returns from browser history. Refresh open details on external edits and close them if the note is deleted.
- Card ordering and C 位 selection are presentation settings; they do not remove a record from the bubble view or duplicate it in storage.

## Bubble note carriers

- Only large and medium bubbles carry note text and respond to note clicks. Small and micro bubbles are visual decoration only, with no title textures or note hit targets.
- Automatically add large/medium bubbles when the visible note count exceeds the configured large/medium count. Preserve all configured small/micro decorations, even when the 34 base bubbles are fully used; support up to 10 extra carriers.
- The configuration panel controls base bubble counts; automatically required carriers remain available without manual configuration.
- Keep large/medium bubbles in a balanced central cluster above the composer, with gentle local drifting. Small/micro decorative bubbles retain their full-screen distribution and movement.

## 时光之眼

- The circular star image on the right is named 时光之眼. Center its white, bold, 28px Microsoft YaHei title over the image, slowly fading in and out on a repeating 10-second breathing cycle. Respect reduced-motion preferences by showing the title steadily.

## Filtering conventions

- Every filter that selects a note type, category, or similar subset must offer an explicit “全部” (All) option. Apply this convention to future features of the same kind.
- The note type filter contains 全部、急事、备忘 in both bubble and card views. All shows both types and is the default when there is no saved selection. The separate category dropdown has been removed at the user's request; existing category metadata is preserved.
- “全部” is a display filter, never a stored note type. In this view, unmarked input defaults to 备忘; explicit 急事/备忘 input determines the saved type. Saving keeps the All view selected.

## Featured card (C 位卡)

- The card view offers one featured slot in the lower center, above the composer. Drag any card into it; the featured card is 15% larger than a normal card and remains clickable.
- Moving a new card into the slot returns the previous card to the single hanging row. Dragging the featured card outside the slot or choosing 移回挂线 clears the slot. The detail dialog offers 设为 C 位 as a keyboard-accessible alternative.
- Persist the featured record ID locally. The featured card always remains displayed across note type/category filters, including a filter with no matching hanging cards. Only hanging cards are filtered. Featuring does not duplicate notes, alter creation dates or consume additional capacity. Clear the selection when that note is deleted.
- Preserve the locked planet/rope geometry.
- During dragging, keep the drop slot visible even in compact windows. Accept a drop when either the pointer or the dragged card's center enters the slot; highlight it before release.

## Hanging card order

- Drag cards left/right along the hanging line to reorder them. Preview the insertion position and shift neighboring cards while dragging; persist the order on release. Cancelled drags leave the saved order intact.
- Default to newest first. Once manually sorted, retain that order and insert new notes at the far left. Sorting a filtered subset preserves the positions of hidden notes in the overall order.
- Keep note metadata, capacity, the single row and the locked planet/rope geometry unchanged. C 位 dragging and replacement remain available.

## Note title generation

- Every saved note must be semantically analyzed by an LLM.
- Generate the short bubble title from an LLM summary of the note; do not use local keyword rules or extractive heuristics as the title-generation path.
- Treat LLM title generation as required for quality. If the model service is unavailable, do not silently present a heuristic title as an AI-generated summary; tell the user and let them retry or explicitly save without a generated title.
- Call the model through a server-side endpoint so provider credentials never ship in browser code. Keep note-text transmission clear to the user and follow the product's privacy policy.

The current prototype still uses local rules in `src/Scene.tsx`; this requirement must be implemented before claiming that titles are LLM-generated.
