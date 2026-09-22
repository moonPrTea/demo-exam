# Preparation and exam plan

## Principle

Prepare for the repeated structure of the exam, not the story of one example.
The nouns and colors can change. The reasoning remains:

```text
understand domain
→ normalize data
→ create and verify PostgreSQL database
→ connect C# application
→ implement role based scenarios
→ apply the current style guide
→ test and package
```

## Level 1 is database design and normalization

The first level is complete only when you can perform the following work by
yourself from unfamiliar source files:

1. State the grain of each source row.
2. Identify entities, events, dictionaries, variants, and link tables.
3. Explain one-to-many and many-to-many relationships.
4. Normalize the source to third normal form.
5. Create one Calc sheet and one CSV per database table.
6. Assign primary keys and replace repeated parent data with foreign keys.
7. Prove that there are no duplicate keys, missing parents, or lost totals.
8. Write DDL in pgAdmin without copying a theme-specific script.
9. Import parents before children and repeat the checks in SQL.

The detailed method is in
[NORMALIZATION_WORKFLOW.md](NORMALIZATION_WORKFLOW.md). Formula patterns are in
[CALC_FORMULAS.md](CALC_FORMULAS.md).

## Recommended Level 1 plan

### Plan A

Use Calc formulas and standard filters. Keep untouched raw sheets, clean helper
columns, normalized entity sheets, and a checks sheet. This is the most useful
method to rehearse because every decision is visible and the workflow adapts to
a new theme.

### Plan B

For very small sources, manually copy entity columns to separate sheets and use
the `No duplication` option. Still assign IDs, create foreign keys with exact
lookups, and run every check. Manual does not mean unverified.

### Plan C

Use a configurable LibreOffice Basic macro only after mastering Plan A. The
macro should read a mapping of sheet names, key columns, and output tables. It
must not contain assumptions such as `Product`, `Order`, or `Size` in its core
logic. Confirm that macros are allowed and enabled on the exam computer.

## Level 1 checkpoints

Stop and verify after each checkpoint:

| Checkpoint | Evidence |
| --- | --- |
| Domain model | Entity list, keys, relationship list, row grain |
| Clean data | Canonical keys and visible anomaly mapping |
| Parent tables | Unique keys, stable IDs, expected distinct counts |
| Child tables | All foreign-key lookups succeed |
| Detail tables | Correct composite key or line ID and reconciled totals |
| CSV files | Values only, one table per file, correct headers and types |
| PostgreSQL | DDL constraints, successful import, zero orphans |

Do not continue to WinForms while a checkpoint is red. Application errors are
much harder to diagnose when the database itself is wrong.

## Later levels

After the database passes:

1. Create a minimal WinForms project and verify one parameterized `SELECT`.
2. Implement authentication and the current variant's role matrix.
3. Implement the central list or catalog with required search, filter, and
   sorting behavior.
4. Implement the main transaction using a PostgreSQL transaction.
5. Add management functions for the roles that require them.
6. Apply the supplied style guide, images, icons, and titles.
7. Test every role and invalid input path.

Do not assume that the shoe example's roles, screens, or color rules are
guaranteed. Extract them again from the actual exam documents.

## Practice program

### Practice 1 Recognition

Take a wide table and mark each column as:

- entity attribute;
- document header attribute;
- detail attribute;
- dictionary value;
- derived value;
- source-only helper.

Explain every decision aloud.

### Practice 2 Calc normalization

Start from raw data and create normalized sheets using only cleaning formulas,
standard filters, stable IDs, and exact lookups. Produce the `CHECKS` sheet.

### Practice 3 SQL from blank file

Without looking at an old schema, write the DDL from the sheet plan. Add keys,
nullability, uniqueness, foreign keys, and checks. Import CSV files and run SQL
validation.

### Practice 4 Same pattern different theme

Repeat the exercise for at least four themes such as commerce, education,
clinic, and rental. Compare the structural patterns after finishing.

### Practice 5 Full mock exam

Use a clean folder, new workbook, empty database, and new Visual Studio
solution. Measure where time is lost. Improve reusable checklists and formula
knowledge, not a solution tied to the mock theme.

## Mistakes that waste the most time

- Writing SQL before defining row grain and relationships.
- Editing raw sheets and losing the original evidence.
- Deduplicating by a visible name that is not actually unique.
- Using approximate lookup instead of exact lookup.
- Assigning IDs with formulas and then sorting without freezing values.
- Hiding unmatched foreign keys with blank strings or zero.
- Exporting formulas, totals, titles, or helper columns to CSV.
- Importing child tables before parent tables.
- Disabling constraints instead of fixing the normalization error.
- Starting WinForms before database counts and relationships are verified.

## What the example package is for

Use it to practice the method:

- identify the grain of every workbook;
- derive tables without reading a supplied solution;
- find hidden spaces, inconsistent names, decimals, dates, and repeated data;
- create normalized sheets and CSV files yourself;
- write and validate the DDL yourself.

The example is not a schema to memorize. A different exam theme should lead to
different entity names but the same reasoning process.
