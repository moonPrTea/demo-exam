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
| Table checks    | Upload your 12 CSVs and schema.json; check PK/FK, duplicates, relationships and source-data preservation           |
| Calc workbook   | One persistent workbook, seven step checks, formula evaluation and final CSV validation                         |
| Progress        | Local history and achievements; no account or cloud sync                                                         |

Only **INDEX + MATCH** (exact match) are formula requirements from `formuly.docx`. Deduplication, Text to Columns and CSV export are separate Calc operations.

## Run

Install Node.js 22.12+ and Git, then in the cloned repository:

```sh
npm ci
npm start
```

The trainer targets macOS and Windows; desktop checks currently run on macOS. Windows still needs runtime verification. Actual WinForms development requires Windows and the Visual Studio visual Designer, with handlers written in C#.

You can also use `Start.command` (macOS) or `Start.cmd` (Windows). They check Node and install project dependencies when missing. The Overview screen checks optional tools and opens their official download pages; it does not install system software. `npm run doctor` runs the same availability checks from a terminal.

## Calc walkthrough

Open **Разбор CSV в Calc** for seven steps on one small synthetic CSV: import, cleanup, deduplication, MATCH, INDEX, paste values and export. Each step includes a question and an example. This mini-lesson extracts a category dictionary, not the complete 12-table exam schema.

**Open my workbook** uses Python 3.9+ and LibreOffice. Your work stays in `calc-lessons/work/lesson.fods` in the app profile; saving as `lesson.ods` in the same folder is also supported. Import the source into **Практика**, follow the steps, save, then click **Check this step**. Checks cover leading zeros, unchanged source data, category keys, INDEX/MATCH formulas, pasted values and final `products.csv` / `categories.csv` (UTF-8, semicolon). Formulas with ordinary cell references are evaluated independently of cached values; named ranges and other functions are outside this lesson.

Demonstration snapshots remain separate. The launcher uses an isolated Calc profile and never overwrites existing work. Without Python/Calc, the in-app lesson and CSV download remain available. Hints are blocked during timed attempts.

## Free local AI

1. Install and open [Ollama](https://ollama.com/download)
2. In **Data generator - AI**, expand the setup section and click **Download model** (Russian UI: «Скачать модель»)
3. Confirm the download, enter a fictional topic, generate and review the draft

The fixed model is [Qwen3 4B Instruct](https://ollama.com/library/qwen3:4b-instruct), approximately 2.5 GB on disk plus working memory. Installation and download require internet. Generation then runs locally; there is no API key, account, paid endpoint or server configuration. This is not a zero-install bundled model.

AI changes vocabulary and the business description **within one of the three existing models**, retaining 3 CSVs and 12 tables. Review and edit the draft before applying it; edited values are validated again. The app creates IDs, relationships, rows and numeric answers. Original WinForms screenshots remain unchanged. The exported module-1 assignment includes steps, deliverables and checking criteria, not a complete official exam pack.

The desktop process connects only to `127.0.0.1:11434`, without credentials or redirects. Prompts contain the entered topic and synthetic vocabulary, not uploaded files or study history. Use fictional topics only. No model or secrets belong in Git. Local-generation behavior is described in [Ollama's FAQ](https://docs.ollama.com/faq).

## Files and replay

Export saves **three CSV files, `assignment.md` and `variant.json`**, without a solved schema or SQL. Normalize the sources yourself and export your 12 tables separately. To reproduce an AI variant, keep and import `variant.json`; the code alone does not include the generated theme. Imported themes work without Ollama.

The exercise format remains 3 CSVs and 12 tables; it does not copy the number of Excel files in the example. Twelve tables is a target for these exercises, not a universal rule of normalization. Old single-file variants remain readable.

**Check your tables**, in the generator or after a timed attempt, accepts 12 CSVs and `schema.json`. Describe each table's role, filename, PK, column mapping and FK links; the on-screen example explains the format. Your IDs, column names and row order may differ. Checks cover the exercise's twelve entities, not every valid decomposition or actual PostgreSQL constraints. Files stay on-device; post-attempt checks are for review, not proof of completion before the deadline.

## Development

Strict TypeScript, Electron and [Google gts](https://github.com/google/gts); 2-space indentation, single quotes, semicolons, brief comments.

The independent [spreadsheet engine](./src/spreadsheet/README.md) powers **Разбор CSV в Calc → Открыть редактор таблиц**: a separate window with a 100×12 grid, formula bar, undo and RU/EN interface. **ƒx** opens the [Calc 25.8 catalog](./docs/calc-catalog.md): 530 functions, bilingual search and categories. Only INDEX/MATCH calculate so far; other entries are explicitly catalog-only. The button beside an argument collapses the wizard: drag over cells, on any sheet, to insert a reference. Escape cancels selection. The demonstration workbook is memory-only, without file import/save. The existing Calc walkthrough still requires LibreOffice.

Right-click a sheet tab to add, rename or delete a sheet. Deletion requires confirmation; the last sheet is protected. Renaming updates formula references; deletion turns them into `#REF!`. Cmd+N or Ctrl+N opens a separate blank workbook.

| Command                | Purpose                                         |
| ---------------------- | ----------------------------------------------- |
| `npm run check`        | Types, lint and logic tests                     |
| `npm run test:engine`  | Spreadsheet engine tests                        |
| `npm run test:sheets`  | Editor workflows and viewport screenshots       |
| `npm run bench:engine` | Local spreadsheet benchmark                     |
| `npm run test:desktop` | Isolated desktop workflow tests                 |
| `npm run preview`      | Browser preview; local AI is desktop-only       |
| `npm run fix`          | Code style fixes                                |
| `npm run package`      | Unsigned build for the current OS in `release/` |

`src/core/` contains exercise logic; `src/app.ts` the UI; `electron/` export and local-AI integration. Generated `build/` files are not edited or committed. AI transport tests use mock responses and do not download a model.

Not implemented: SQL execution/grading, modules 2–4, automatic installation of system tools, or blocking other applications. Windows runtime testing remains pending; local tests do not establish Windows compatibility. Sources: `formuly.docx`, the supplied 2027 exam attachments and the teacher's [ShoeStore example](https://github.com/KesinWeb/ShoeStore).
