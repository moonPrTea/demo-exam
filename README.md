# formatted

[Русская версия](./README.ru.md)

A local desktop trainer for the database module of the college demonstration exam. Understand the data, normalize it yourself in LibreOffice Calc, then create and query PostgreSQL tables in pgAdmin.

## What works

| Mode            | Practice                                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| Quiz            | 44 questions, including 25 on INDEX and MATCH: meaning, choosing an approach, evaluating and debugging formulas  |
| Data generator  | Three related CSV files to normalize into 12 tables; retail, libraries or courses; changing selection conditions |
| Custom AI theme | Enter a topic, review Qwen's proposed description and names, then apply them to the selected data model          |
| Timed practice  | Persistent countdown, three numeric answer checks and a normalization self-check                                 |
| Progress        | Local history and achievements; no account or cloud sync                                                         |

Only **INDEX + MATCH** (exact match) are formula requirements from `formuly.docx`. Deduplication, Text to Columns and CSV export are separate Calc operations.

## Run

Install Node.js 22.12+ and Git, then in the cloned repository:

```sh
npm ci
npm start
```

The trainer targets macOS and Windows; desktop checks currently run on macOS. Windows still needs runtime verification. Actual WinForms development requires Windows and the Visual Studio visual Designer, with handlers written in C#.

## Calc walkthrough

Open **Разбор CSV в Calc** for seven steps on one small synthetic CSV: import, cleanup, deduplication, MATCH, INDEX, paste values and export. Each step includes a question and an example. This mini-lesson extracts a category dictionary, not the complete 12-table exam schema.

**Open step in Calc** uses Python 3.9+ and an installed LibreOffice. A standard-library Python script creates a fresh `source.csv` and editable `lesson.fods`, highlights the target cell and adds an instruction sheet. Each step is an independent snapshot; edits are not carried forward. Files live in `calc-lessons/` inside the app's local profile. A separate Calc profile avoids changing your working documents; no macros, mouse automation or extra Python packages are used. Without Python/Calc, the in-app lesson and CSV download still work. Lesson hints are blocked during timed attempts.

## Free local AI

1. Install and open [Ollama](https://ollama.com/download)
2. In **Data generator - AI**, expand the setup section and click **Download model** (Russian UI: «Скачать модель»)
3. Confirm the download, enter a fictional topic, generate and review the draft

The fixed model is [Qwen3 4B Instruct](https://ollama.com/library/qwen3:4b-instruct), approximately 2.5 GB on disk plus working memory. Installation and download require internet. Generation then runs locally; there is no API key, account, paid endpoint or server configuration. This is not a zero-install bundled model.

AI changes vocabulary and the business description **within one of the three existing models**, not arbitrary database structures. The app creates IDs, relationships, CSV rows and selection answers. Structured output is validated; semantic correctness still needs review. Original WinForms screenshots, layout and style requirements are not generated or edited. The exported assignment is a module-1 adaptation, not a complete official exam pack.

The desktop process connects only to `127.0.0.1:11434`, without credentials or redirects. Prompts contain the entered topic and synthetic vocabulary, not uploaded files or study history. Use fictional topics only. No model or secrets belong in Git. Local-generation behavior is described in [Ollama's FAQ](https://docs.ollama.com/faq).

## Files and replay

Export saves **three CSV files, `assignment.md` and `variant.json`**, without a solved schema or SQL. Normalize the sources yourself and export your 12 tables separately. To reproduce an AI variant, keep and import `variant.json`; the code alone does not include the generated theme. Imported themes work without Ollama.

The exercise format remains 3 CSVs and 12 tables; it does not copy the number of Excel files in the example. Twelve tables is a target for these exercises, not a universal rule of normalization. Old single-file variants remain readable.

## Development

Strict TypeScript, Electron and [Google gts](https://github.com/google/gts); 2-space indentation, single quotes, semicolons, brief comments.

| Command                | Purpose                                         |
| ---------------------- | ----------------------------------------------- |
| `npm run check`        | Types, lint and logic tests                     |
| `npm run test:desktop` | Isolated desktop workflow tests                 |
| `npm run preview`      | Browser preview; local AI is desktop-only       |
| `npm run fix`          | Code style fixes                                |
| `npm run package`      | Unsigned build for the current OS in `release/` |

`src/core/` contains exercise logic; `src/app.ts` the UI; `electron/` export and local-AI integration. Generated `build/` files are not edited or committed. AI transport tests use mock responses and do not download a model.

Not implemented: automatic grading of normalized schemas or arbitrary SQL, modules 2–4, installing Calc/PostgreSQL, or blocking other applications. Sources: `formuly.docx`, the supplied 2027 exam attachments and the teacher's [ShoeStore example](https://github.com/KesinWeb/ShoeStore).
