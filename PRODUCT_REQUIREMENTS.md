# Product requirements

## Note title generation

- Every saved note must be semantically analyzed by an LLM.
- Generate the short bubble title from an LLM summary of the note; do not use local keyword rules or extractive heuristics as the title-generation path.
- Treat LLM title generation as required for quality. If the model service is unavailable, do not silently present a heuristic title as an AI-generated summary; tell the user and let them retry or explicitly save without a generated title.
- Call the model through a server-side endpoint so provider credentials never ship in browser code. Keep note-text transmission clear to the user and follow the product's privacy policy.

The current prototype still uses local rules in `src/Scene.tsx`; this requirement must be implemented before claiming that titles are LLM-generated.
