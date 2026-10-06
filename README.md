# Demo Exam — gamified preparation

English version · [Русская версия — полный README на русском](README.ru.md)

Status: requirements and learning methodology; the application is not implemented yet. Updated October 6, 2026.

The goal is to solve a demonstration exam independently in an unfamiliar domain: understand source data, normalize it in LibreOffice Calc, write SQL in pgAdmin, and build a C# WinForms application in Visual Studio. Producing a ready-made shoe store solution is not the goal.

This is the main English README; [README.ru.md](README.ru.md) is its full Russian counterpart. Both describe the same curriculum, constraints, application concept, and development plan. Update both when requirements change. Previous standalone guides remain available in Git history.

The core principle is transferable understanding, not memorizing an example. The shoe store and supplied files are illustrations only. For any new dataset, the learner must identify row meaning, entities, dependencies, keys, relationships, and rules again. A library, rental service, or training center may need a different model; the reasoning and verification process transfers. Do not assume every task contains products, orders, sizes, or stock.

## 1. Agreed requirements and open questions

| Requirement | Implication |
| --- | --- |
| The learner performs normalization | Source data → independently identified entities → Calc sheets → one CSV per table. The trainer does not split the data for the learner. |
| The learner writes SQL | Create the database, tables, and constraints in pgAdmin; importing data does not replace schema design. |
| WinForms uses the Visual Studio visual Designer | Confirmed by the user. Place controls visually; write event handlers and logic in C#. Automatically generated `.Designer.cs` files are expected. |
| Core tools | PostgreSQL, pgAdmin, LibreOffice Calc, Visual Studio, the permitted Npgsql version and its required dependencies. Do not depend on EF, third-party UI libraries, or internet access. |
| Four application modules | The division below is a proposed learning structure, not yet a verified mapping to official exam modules. |
| Triggers and other database objects | Include them in extended preparation. Confirm whether they are mandatory, and to what extent, against the current official exam specification and scoring criteria. |
| Gamified learning without copying | Tasks, explanations, graduated hints, and fresh variants. Do not provide the complete solution to the active assessment. |
| Current stage | Documentation only. The launcher, application, restrictions, and validation engine do not exist yet. |

### Sources and their limits

- `formuly.docx`, pages 1–3: text and screenshots were reviewed. The method covers deduplication, `INDEX + MATCH`, freezing numeric IDs, preparing dates, Text to Columns, whitespace cleanup, and exporting the active sheet to CSV.
- `Прил_ОЗ_КИМ_09.02.07-2-2027.zip`: domain, resources, and style appendices. These are example materials, not a complete specification with duration and scoring. The reviewed domain description does not require triggers.
- The teacher's [ShoeStore repository](https://github.com/KesinWeb/ShoeStore), revision `d5b5ab4d17e659157fd862cfb7c9ae0d75faf83b`: project configuration, main forms, a user control, order handling, and the text SQL script were reviewed. This is a teaching reference, not an exam specification or an infallible solution.
- Official tool documentation clarifies behavior. Verify compatibility with the versions installed on the exam computer before implementation.

A meaningful mismatch: the 2027 appendix requires login without a password, while the teacher's `AutForm.cs` uses both login and password. Derive roles, colors, tables, and workflows from the current task, not from a previous project.

## 2. Four learning modules

| Module | Learner's work | Evidence to check |
| --- | --- | --- |
| 1. Data and normalization | Analyze sources, explain relationships, prepare lookup and child tables in Calc | Working `.ods`, entity/key description, CSV files, reconciliation checks |
| 2. PostgreSQL | Write DDL, import data, check constraints; separately study functions and triggers | Own SQL, practice database, integrity and restore checks |
| 3. C# and WinForms | Build forms visually; write events, queries, and workflows | Buildable project, database integration, role and input checks |
| 4. End-to-end practice | Complete a fresh variant from source files to submission under a timer | Solution, test record, submission package, review of time and errors |

Each module combines a short quiz with work in the actual tools. A quiz does not replace working CSV, SQL, or C# artifacts.

## 3. Module 1: normalization in LibreOffice Calc

### 3.1. Model first, formulas second

Before editing, answer: “What does one source row represent?” It could be an item, an item variant, a document line, or a mixture of entities. Equal names do not necessarily identify the same entity, and not every repeated value needs its own lookup table.

1. Preserve unchanged sources. Create a working `.ods` with source sheets, intermediate calculations, final tables, and checks.
2. Identify entities, attributes, events, 1:N and M:N relationships. Identify natural keys where they genuinely exist.
3. Explain the decomposition through dependencies: atomic values and no repeating groups; non-key attributes depending on the whole composite key; no transitive dependencies between non-key attributes. Explain 1NF–3NF using the actual data.
4. Record the row meaning, primary key, foreign keys, required fields, uniqueness rules, and valid values for every table.
5. Transform the data and demonstrate that records, relationships, and meaningful totals were preserved.

An illustrative question: a product model and its available sizes may belong to different tables; a document header and its lines represent different levels. A sale price on a line may be a historical fact rather than a copy of the current catalog price. Derive the decision from requirements, not a memorized schema.

### 3.2. The `formuly.docx` method, with clarifications

**Step 1. Clean values before deduplication.** Check leading, trailing, and non-breaking spaces, blanks, types, case, and spelling. Do not automatically merge similar names: they may describe different entities. Preserve a mapping between original and corrected values. Import identifiers with leading zeros as text.

**Step 2. Build lookup tables.** Identify the set of attributes that uniquely defines a record, then deduplicate that set. The handout shows different menu commands for different Calc versions. A fallback for one column is Data → More Filters → Standard Filter, non-empty values, No duplications, Copy results. Do not deduplicate each column independently when identity depends on several columns: that destroys combinations.

Sorting does not remove duplicates. In an advanced filter, the criteria range and data range serve different purposes; do not mechanically copy an ambiguous screenshot setting. Deduplication in the official Calc example is case-sensitive. [Calc documentation](https://help.libreoffice.org/latest/en-US/text/scalc/guide/remove_duplicates.html).

**Step 3. Assign stable primary keys.** Assign unique lookup IDs and freeze them as values before reordering. If source IDs already exist, check their suitability. A spreadsheet row number is not a record identifier.

**Step 4. Look up foreign keys with an exact match.** On the `Lookup` sheet, column A contains existing IDs and column B contains unique cleaned values. C2 on the current sheet contains the value to find.

This is a LibreOffice Calc formula for preparing data before export, not a formula stored inside a CSV. The English version uses English function and sheet names; CSV files contain the calculated values. The [Russian README](README.ru.md) provides the localized Russian formula.

```text
=INDEX(Lookup.$A$2:$A$100;MATCH(C2;Lookup.$B$2:$B$100;0))
```

- `MATCH(...;0)` finds the position of an exact match in the name range.
- `INDEX` returns the ID at the corresponding position in column A. If the matched record has ID 17, the result is 17, not its position in the sheet.
- Both ranges start on the same row, have equal heights, and use `$` to keep them fixed. C2 changes when filling down.
- Include the entire dataset; 100 is only an example boundary.
- Repeated names require a valid key: returning the first match does not resolve ambiguity.
- A lookup error is a reason to investigate a missing parent, whitespace, or a type mismatch, not to silently replace the error with zero.

Function names and separators depend on Calc settings. This example requires English function names and uses semicolons as argument separators. For keys containing `*`, `?`, or other special characters, check wildcard/regular-expression settings: the key must be interpreted literally. [Calc lookup functions](https://help.libreoffice.org/latest/en-US/text/scalc/01/04060109.html).

**Step 5. Freeze exported values.** Following the handout, copy calculated numeric foreign keys and Paste Special as numbers into an export copy of the sheet. Keep the working `.ods` with formulas separately. Paste text identifiers as text values to preserve leading zeros. Once foreign keys have been assigned, do not renumber the parent independently of its children.

**Step 6. Prepare dates and compound cells.** The handout screenshot uses `YYYY-MM-DD`, for example `1999-12-01`. Changing display formatting does not convert arbitrary text into a real date: first parse the day, month, and year, and check ambiguous cases.

Text to Columns helps parse the source but does not complete normalization. Splitting `A112T4, 2, F635R4, 2` must eventually produce two detail rows with the same parent ID: `(document, A112T4, 2)` and `(document, F635R4, 2)`. Check pair counts, empty elements, and quantities. Do not assume a full name always contains exactly three words or uniquely identifies a person.

**Step 7. Export each final table.** Save the workbook, then export the active sheet as Text CSV, UTF-8. Use one file per table; CSV does not contain multiple sheets. Specify the header, field delimiter, quotation marks, empty values, numbers, and dates. The screenshot uses a comma delimiter, not a universally required semicolon. Export settings must match the pgAdmin import settings.

Inspect the raw CSV and perform a trial import. A decimal comma must not split columns, dates must remain interpretable, identifiers must retain their text representation, and quoted text containing delimiters or line breaks must remain intact. Distinguish SQL `NULL`, an empty string, and zero. Exclude totals, formulas, helper columns, and decorative headings from the exported table.

### 3.3. Plan A and alternatives

| Approach | When to use it | Required safeguards |
| --- | --- | --- |
| A: lookup tables + exact-match formulas | Main method to practice until confident | Independent modeling, stable IDs, verification |
| B: copy selected fields + deduplication filter | Small datasets or older Calc versions without the newer duplicate command | Exact foreign-key lookup and the same checks; no guessed IDs |
| C: a self-written Calc macro | Later, only if permitted and understood | Verify the result and be able to repeat the process without it |

Excel VBA and LibreOffice Basic are not interchangeable. Start without macros and master the handout's method first. Automation must not choose entities or write the final schema instead of the learner.

### 3.4. Completion criteria

- Explain each table's row meaning and key; no duplicate primary keys or unexplained blanks remain.
- Every required foreign key references one parent; lookup errors are not hidden.
- Reconcile document counts, detail counts, quantities, and totals where meaningful. The combined row count of all normalized tables need not equal the source row count.
- Reconcile the elements expanded from compound cells; no details are lost or accidentally duplicated.
- Reopen the CSV files and confirm types, Cyrillic text, dates, and identifiers.
- Explain the table choices and repeat the method in another domain without being given the decomposition.

## 4. Module 2: database creation and SQL

### 4.1. Core curriculum

1. Distinguish the PostgreSQL server, database, schema, table, role, and pgAdmin client.
2. Create a practice database and write table SQL independently: types, primary keys, `NOT NULL`, `UNIQUE`, foreign keys, `CHECK`, and deletion rules. Do not enable cascading deletion without understanding its consequences.
3. Choose types by meaning: exact `numeric` for money, `date` for dates, text for identifiers, and an appropriate constrained numeric type for quantities.
4. Import parents before children. Specify column order, headers, UTF-8, delimiters, and NULL handling. Check the settings and import log in the installed pgAdmin version. [Import/Export dialog](https://www.pgadmin.org/docs/pgadmin4/latest/import_export_data.html).
5. After importing explicit IDs into a sequence/identity-backed column, align the generator with the imported values. Test an insert with an automatically generated ID; account for the identity mode in the installed PostgreSQL version.
6. Write checks for duplicates, missing parents, required values, quantities, and totals. Reconcile with Calc.
7. Learn `JOIN`, `LEFT JOIN`, `GROUP BY`, aggregates, search, sorting, filtering, and data changes. Distinguish `WHERE` from `HAVING`.
8. Learn transactions: related changes commit together or roll back. An error halfway through must not leave a partial document.
9. Save SQL and a backup, then test restoration into a separate practice database. A SQL script and a restore archive are different formats; a filename extension does not guarantee the format.

The trainer identifies the error category and a counterexample, but does not replace the learner's DDL with generated tables. Restoring somebody else's dump does not count as creating a database independently.

### 4.2. Functions, views, and triggers

This is a separate learning branch, not yet confirmed as mandatory for the specific exam:

- First enforce rules with `NOT NULL`, `UNIQUE`, foreign keys, and `CHECK` where appropriate. Do not replace a simple constraint with a trigger.
- Compare views, ordinary functions, procedures, and triggers: what invokes them, what they return, and where the rule executes.
- Study functions returning `trigger`, `NEW`, `OLD`, `TG_OP`, `BEFORE`/`AFTER`, `FOR EACH ROW`/`STATEMENT`, `INSERT`/`UPDATE`/`DELETE`, and `RETURN` behavior.
- Start with a small change-audit exercise; move to stock or status rules only when relevant to the task.

A trigger is associated with an event and invokes a trigger function. Row-level and statement-level triggers have different invocation frequencies; a trigger on `SELECT` is not supported. Check syntax against the installed version. [PostgreSQL: CREATE TRIGGER](https://www.postgresql.org/docs/current/sql-createtrigger.html).

For a stock exercise, test insertion, quantity changes, changing the referenced item, deletion/cancellation, insufficient stock, rollback, and concurrent operations. Account for the difference between old and new quantities rather than subtracting the full amount again. Do not deduct stock in both C# and a trigger. Before importing historical documents, establish whether their effects are already reflected in source stock values. These are modeling questions, not reasons to add a stock trigger to every database.

### 4.3. Completion criteria

The learner's SQL creates the database from scratch; imports do not require disabling constraints; invalid data is rejected; verification queries confirm integrity. The learner explains types and rules. The trigger branch requires event and rollback tests, not merely an object visible in pgAdmin.

## 5. Module 3: visual WinForms and thoughtful C#

### 5.1. Workflow constraint

Create forms and `UserControl` templates using the Visual Studio visual Designer: controls, names, properties, layout, bindings, and events. Write handlers, validation, data access, and helper classes in C#.

- Do not replace the Designer by constructing the entire interface with `new Button`, coordinates, and `Controls.Add` in a form constructor.
- Do not manually edit `.Designer.cs` as the main UI development method. Preserve `InitializeComponent()` and generated files.
- Runtime instances of a visually designed card may be added to a `FlowLayoutPanel`. Dynamic data does not require coding each card's layout from scratch.
- Constructors initialize the form and accept context. Database loading must not break the Designer; long-running work must not freeze the interface.

### 5.2. Learning and implementation order

1. **C#:** types, `null`, conditions, loops, methods, classes, collections, events, exceptions, and `using`. Connect exercises to handlers, not just terminology.
2. **First run:** new project, a visually designed form, a button and event, build and run.
3. **Connection:** keep credentials out of published files; execute one query; report unavailable databases without exposing passwords.
4. **List:** read and display data; handle empty results and missing images; dispose readers, connections, and images appropriately when refreshing.
5. **Search, sorting, filtering:** shared consistent state without resetting unrelated choices. Parameterize values; select column names and sort directions from an allowlist.
6. **Lookup controls:** `DisplayMember`, `ValueMember`, `SelectedValue`; the displayed label, list position, and database ID are different things.
7. **Create and edit:** required fields, `TryParse`, ranges, `DBNull`, and `decimal` for money. Use parameterized commands and refresh after success.
8. **Multi-step operations:** header and lines in one transaction; obtain IDs from the database, not `MAX(id) + 1`.
9. **Roles:** derive the permission matrix from the task. Check permissions when executing actions, not just by hiding buttons. Signing out must remove previous access.
10. **Submission:** current style, titles, logo, icon, and highlighting; verify resources and execution outside the development folder.

For an older permitted Npgsql version, use compatible APIs: `NpgsqlConnection`, `NpgsqlCommand`, parameters, readers, and transactions. Do not require `NpgsqlDataSource`, introduced in Npgsql 7. C# syntax must also be supported by the selected compiler. [Npgsql: connections, parameters, and transactions](https://www.npgsql.org/doc/basic-usage.html).

### 5.3. Lessons from the teacher's repository

Links are pinned to the reviewed commit so later changes do not alter the comparison.

| Observation | Teaching decision |
| --- | --- |
| The [project](https://github.com/KesinWeb/ShoeStore/blob/d5b5ab4d17e659157fd862cfb7c9ae0d75faf83b/ShoeStore/ShoeStore.csproj) targets .NET Framework 4.8; its [packages](https://github.com/KesinWeb/ShoeStore/blob/d5b5ab4d17e659157fd862cfb7c9ae0d75faf83b/ShoeStore/packages.config) include Npgsql 8.0.3 | This is the example's environment, not confirmed exam tooling. Agree on our environment separately. |
| [AutForm](https://github.com/KesinWeb/ShoeStore/blob/d5b5ab4d17e659157fd862cfb7c9ae0d75faf83b/ShoeStore/Forms/AutForm.cs) uses a visual form, events, and parameters | Teach control → event → validation → query → navigation, without automatically adopting password login. |
| [MainForm](https://github.com/KesinWeb/ShoeStore/blob/d5b5ab4d17e659157fd862cfb7c9ae0d75faf83b/ShoeStore/Forms/MainForm.cs) populates cards and combines loading options | Teach reusable visual controls and coordinated filtering, search, and sorting. |

Debugging exercises from the reviewed code include interpolated user values in SQL and reading search text through `KeyDown` in `MainForm`; IDs calculated as `SelectedIndex + 1` and separate header/detail inserts without a shared transaction in [order handling](https://github.com/KesinWeb/ShoeStore/blob/d5b5ab4d17e659157fd862cfb7c9ae0d75faf83b/ShoeStore/Controls/AddZakazPanelRedact.cs). Teach parameters, an appropriate text-change event, real selected IDs, and atomic saving. A test with IDs 3 and 17 catches the list-index mistake.

The reviewed text SQL script does not define custom triggers. This does not prove their absence from every resource or establish exam requirements. The binary dump was not fully restored during this review. Do not copy the teacher's project wholesale.

### 5.4. Completion criteria

The learner independently creates a form in the Designer, connects an event to a handler, explains a query, and fixes a small defect using fresh data. The project builds with permitted packages. Check empty lists, invalid input, every role, combined search/filter behavior, unavailable databases, and rollback of multi-step operations. Functional checks are supplemented by a demonstration of using the visual Designer.

## 6. Module 4: timed practice

A variant starts with an unfamiliar domain, source files, and requirements, not a completed schema:

1. Identify entities, required workflows, roles, style, and submission artifacts.
2. Prepare and check data before importing it.
3. Create the database, import, and verify integrity.
4. Build a minimal working scenario: database read → form → correct action.
5. Add the remaining required scenarios and styling.
6. Run positive and negative tests; check the submission package.
7. Review causes of mistakes: modeling, syntax, attention, environment, or time allocation.

Until the official duration is known, the timer is configurable; do not invent an “official exam” limit. Measure stages first, then improve personal bottlenecks. Reserve time for verification without presenting a practice target as an official rule.

Time-saving habits: early environment checks, a consistent workflow, meaningful control names, a shared list-refresh method, exact foreign-key mapping, a trial import, and empty-state tests. Do not trade correctness for disabled constraints, guessed IDs, or a copied schema.

## 7. Gamification without rote memorization

### 7.1. Learning loop

Situation → prediction → independent action in the real tool → validation → explanation → fresh case → spaced review.

Quizzes occupy a small part of each session. Progress comes mainly from practice and fixing mistakes. Variants change more than names: introduce non-contiguous IDs, composite keys, blanks, multiple details, and ambiguous labels.

| Format | Example | Evidence of understanding |
| --- | --- | --- |
| Blitz quiz | How does a primary key differ from a Calc row number? | Explanation and counterexample |
| Find the defect | A foreign-key lookup breaks after sorting | The fix survives reordering |
| Predict the result | What happens when a foreign key has no parent? | Prediction confirmed in a practice database |
| Mission | Expand code/quantity pairs | Relationships, details, and quantities preserved |
| C# debugging | The second list item has ID 17 | Correct handling of non-contiguous IDs |
| Integrity challenge | Saving the second detail fails | Rollback leaves no partial document |

### 7.2. Modes and hints

- **Learning:** level 1 asks a diagnostic question; level 2 points to a concept or action; level 3 gives a small analogous example using different data. No complete solution to the active task.
- **Reinforcement:** limited hints, a fresh variant, and an independence report. Errors do not erase learning progress.
- **Mock exam:** hints and reference answers remain unavailable until submission; only resources permitted by the selected exam profile are accessible. Emergency exit is always available and marks the attempt interrupted rather than deleting it.
- **Review:** after submission, explain causes, counterexamples, and alternative approaches; then require a fresh task without hints.

Separate activity XP from skill mastery. A proposed mastery rule is two independently completed variants plus a later review; this is a trainer setting, not an exam grade. Success with a hint does not yet establish independence.

Achievements can include “No Missing Foreign Keys,” “New Domain, Same Reasoning,” “Clean Rollback,” “Cause Found Before Fixing,” and “Restore Verified.” Speed rewards require correctness first. Attendance streaks and missed-day penalties must not become the main incentive.

A local open repository cannot guarantee that copying is impossible: users can inspect files and execute code through the IDE. The objective is honest self-assessment, deferred review, and transferable skills, not a claim of secure proctoring.

## 8. Windows application

### 8.1. Launch and environment

Target flow: clone repository → run `Start.cmd` → check environment → choose module → start session. That script does not exist yet.

The script checks the environment and starts the trainer. It must not silently install Visual Studio, PostgreSQL, or system policies. Explain missing components and preparation steps. A later installer may run with explicit consent and verified sources and versions.

The machine profile records:

- Windows and application paths;
- Visual Studio, the .NET desktop development workload, target framework, and targeting/developer pack;
- the PostgreSQL server separately from pgAdmin, plus practice connection settings;
- LibreOffice, function language, separators, and CSV settings;
- the exact Npgsql version and all dependencies needed for offline restore;
- permitted documentation, hints, and time limits.

Do not store passwords in Git or globally weaken PowerShell Execution Policy. Verify connection to a practice database, opening the Designer, and building a minimal project with local packages—not just whether application files exist.

A separate local C# process with a simple WinForms interface is the preferred trainer design; choose its target platform after checking the machines. A prepared build avoids building the trainer on every launch. Exam-solution library restrictions remain separate from the trainer's internal implementation.

### 8.2. Minimal interface

The main window shows four modules, resume, and progress. During work, display a compact panel with the objective, timer, Open Tool, Hint, Check, Finish, and a visible exit. Show achievements after a stage without covering the editor.

Calc, pgAdmin, and Visual Studio remain independent applications. The trainer opens a file or tool and validates the result; it does not embed an entire IDE. Measure elapsed time independently of window repainting, save checkpoints, and record pauses/restarts according to the mode. Reaching the time limit must not close editors or destroy work.

### 8.3. Focus mode and safe exit

The first version provides voluntary soft focus: when enabled, detect switching to an unrelated application and show a reminder. Do not terminate other processes, intercept all input, or hide system recovery tools. This is a limited first step toward the requested blocking feature, not equivalent enforcement.

Allow applications per module: Calc; pgAdmin and necessary PostgreSQL components; Visual Studio, build tools, debugger, and the learner's application; file explorer, file dialogs, system settings, and accessibility tools. Account for child processes. Allowing a browser for pgAdmin does not restrict its other sites; a process allowlist cannot solve that.

The provisional exit shortcut is `Ctrl+Alt+Shift+Q`, checked for availability and replaced if it conflicts. The user sees and tests it before enabling restrictions. If registration fails, restricted mode must not start.

Exit must **release restrictions and preserve state, not crash editors**. A stricter mode needs an independent exit process, communication with the main process, and fail-open behavior. It must not terminate Calc, Visual Studio, or PostgreSQL. Keep an exit button and a system recovery path. Do not promise shortcut availability on the Windows secure desktop.

Actual application-launch restrictions are a separate later stage for a dedicated account or virtual machine. They require administrator rights, a suitable Windows edition, compatibility checks, and a rollback plan. Windows Assigned Access supports a restricted set of applications, but it is an OS configuration, not a property of a full-screen window. [Microsoft documentation](https://learn.microsoft.com/en-us/windows/configuration/assigned-access/).

Focus logging requires consent and records only application identity and switching time. Do not record keystrokes, document contents, personal window titles, or continuous screenshots. Provide log viewing and deletion; data stays local by default.

## 9. Validation and architecture

### 9.1. Automated and manual checks

| Artifact | Method | Limitation |
| --- | --- | --- |
| CSV | Parsing, keys, references, types, record counts, totals | CSV cannot prove formula use; inspect the `.ods` and explanation too |
| Database schema | Metadata, constraints, queries, negative inserts | Do not require identical names or DDL |
| Function/trigger | Event, rollback, and boundary tests | Object existence is insufficient |
| C# | Build, individual methods, queries, scenarios | A warning-free build does not prove correctness |
| UI and Designer | Demonstration, checklist, screenshots with consent | `.Designer.cs` cannot prove how the UI was created; automation is limited |
| Explanation | Causes and counterexamples | Start with self-review or a teacher, not a false claim of precise free-text grading |

Accept multiple valid models. If names differ, the learner maps entities to their schema; validate meaning and behavior. A schema unsupported by the validator needs review, not an automatic incorrect verdict.

Each task describes the skill, source data, rules, accepted alternatives, output, tests, hints, and review conditions. Preserve generation parameters to reproduce failures. Do not insert solutions into the learner's working files.

### 9.2. Logical components

- **Content:** variants, tasks, hints, criteria, and sources.
- **Session:** module, mode, timer, checkpoints, and completion.
- **Tools:** environment checks and opening applications/files.
- **Validation:** separate CSV, database, and project checks; counterexample reports.
- **Progress:** skills, independence, errors, reviews, and achievements.
- **Focus:** optional restrictions and an independent safe exit.

Local structured state files are enough initially; no server, accounts, or cloud are required. Do not store progress in the exercise database that the learner may create or delete.

Checks operate only on dedicated practice databases and attempt directories. Use minimal privileges for inspection; run mutating tests on an isolated copy or within a rolled-back transaction where applicable. Commit and concurrency tests require a separate database. Never automatically run SQL or a project with administrator privileges. Do not delete databases by name prefix alone: maintain an explicit attempt-object list and confirm cleanup.

## 10. Development order and acceptance

Demonstrate that the learning loop helps solve a practical task before developing computer restrictions.

| Stage | Scope | Acceptance condition |
| --- | --- | --- |
| 0. Profile | Specification, versions, packages, criteria | Requirements mapped to skills; unknowns identified |
| 1. Module 1 prototype | Launch, mission, Calc, hints, CSV checks, progress | Learner prepares `.ods` and CSV independently; missing FK and invalid export detected; restart preserves the attempt |
| 2. Module 2 | Database, import, constraints, trigger branch | Inserts and rollback checked; unrelated databases untouched |
| 3. Module 3 | C#, forms, queries, transactions | Builds on the agreed profile; IDs 3/17 and second-detail failure tests pass |
| 4. End-to-end mode | Multiple domains, timer, rubric, reports, review | Fresh variant completed without hints; changing domains does not break validation |
| 5. Focus | Soft mode; strict restrictions considered separately | Exit tested with the main window hung; editors and data remain intact |

General criteria: clear missing-tool diagnostics; offline sessions after preparation; recoverable progress; Cyrillic and space-containing paths; no secrets in Git; no unrelated file or system-policy changes without separate consent.

## 11. Questions before implementation

1. Complete current exam specification: official modules, duration, scores, permitted resources, and submission artifacts. Example appendices are insufficient.
2. Windows, Visual Studio, .NET, Npgsql, PostgreSQL, pgAdmin, and LibreOffice versions. Availability of all offline NuGet dependencies.
3. Where the trigger requirement is stated; whether functions, procedures, or views are required, and which scenarios are assessed.
4. Whether macros, templates, reference documentation, and internet access are allowed; what counts as independent work.
5. Whether enforced restrictions on a dedicated account are needed or voluntary focus is sufficient.

A normalization learning prototype can proceed before every question is answered. Do not claim full exam compliance, lock in unverified versions, or deploy system restrictions until the relevant details are confirmed.
